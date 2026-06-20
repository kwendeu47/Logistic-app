"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAdminId } from "../../../../lib/auth";
import { logAdminAction } from "../../../../lib/audit";
import { prisma } from "../../../../lib/prisma";
import { refundBookingPartial, releaseEscrowPartial } from "../../../../lib/stripe";

type Resolution = "RESOLVED_SENDER" | "RESOLVED_TRAVELER" | "RESOLVED_SPLIT";

export async function resolveDisputeAction(
  disputeId: string,
  resolution: Resolution,
  splitPercentToTraveler: number,
  note: string,
) {
  const adminId = getCurrentAdminId();

  const dispute = await prisma.dispute.findUniqueOrThrow({
    where: { id: disputeId },
    include: { booking: { include: { traveler: true } } },
  });
  const booking = dispute.booking;

  const refundPercent =
    resolution === "RESOLVED_SENDER" ? 100 : resolution === "RESOLVED_TRAVELER" ? 0 : 100 - splitPercentToTraveler;
  const releasePercent = 100 - refundPercent;

  const refundAmount = (booking.totalPriceUsd * refundPercent) / 100;
  const releaseAmount = (booking.travelerPayoutUsd * releasePercent) / 100;

  if (refundAmount > 0 && booking.stripePaymentIntentId) {
    await refundBookingPartial({
      bookingId: booking.id,
      paymentIntentId: booking.stripePaymentIntentId,
      amountUsd: refundAmount,
    });
  }

  if (releaseAmount > 0 && booking.traveler.stripeAccountId) {
    await releaseEscrowPartial({
      bookingId: booking.id,
      travelerStripeAccountId: booking.traveler.stripeAccountId,
      amountUsd: releaseAmount,
    });
  }

  await prisma.dispute.update({
    where: { id: disputeId },
    data: { status: resolution, resolutionNote: note, resolvedAt: new Date() },
  });

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "COMPLETED", escrowStatus: refundPercent === 100 ? "REFUNDED" : "RELEASED" },
  });

  await logAdminAction({
    adminId,
    action: "RESOLVE_DISPUTE",
    targetId: disputeId,
    metadata: { resolution, refundAmount, releaseAmount, note },
  });

  revalidatePath(`/disputes/${disputeId}`);
  revalidatePath("/disputes");
}
