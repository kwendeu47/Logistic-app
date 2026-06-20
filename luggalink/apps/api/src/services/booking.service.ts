import { randomUUID, createHash } from "node:crypto";
import type { Booking } from "@prisma/client";
import PDFDocument from "pdfkit";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { emitToBooking } from "../config/socket";
import { uploadToS3 } from "../utils/s3";
import { logAuditEvent } from "../utils/audit";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../utils/errors";
import * as notificationService from "./notification.service";
import * as stripeService from "./stripe.service";

const PLATFORM_FEE_RATE = 0.1;
const TRAVELER_PAYOUT_RATE = 0.9;
const INSURANCE_FEE_USD = 2.0;

const ACTIVE_BOOKING_ENTITY = "Booking";

export const createBookingSchema = z.object({
  itemRequestId: z.string().uuid(),
  tripId: z.string().uuid(),
  hasInsurance: z.boolean().optional().default(false),
});

export const itemPostedSchema = z.object({
  trackingNumber: z.string().min(1),
  photoUrls: z.array(z.string().url()).min(1),
});

export const pickupConfirmedSchema = z.object({
  photoUrls: z.array(z.string().url()).min(1),
  scannedQrCode: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const deliveryConfirmedSchema = z.object({
  photoUrls: z.array(z.string().url()).min(1),
  scannedQrCode: z.string().min(1),
  recipientSignature: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const disputeSchema = z.object({
  reason: z.enum(["ITEM_NOT_RECEIVED", "ITEM_DAMAGED", "WRONG_ITEM", "TRAVELER_NO_SHOW", "OTHER"]),
  description: z.string().min(1),
  evidenceUrls: z.array(z.string().url()).default([]),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type ItemPostedInput = z.infer<typeof itemPostedSchema>;
export type PickupConfirmedInput = z.infer<typeof pickupConfirmedSchema>;
export type DeliveryConfirmedInput = z.infer<typeof deliveryConfirmedSchema>;
export type DisputeInput = z.infer<typeof disputeSchema>;

function generateQrSealCode(): string {
  const uuid = randomUUID();
  const hash = createHash("sha256").update(uuid).digest("hex").slice(0, 8);
  return `${uuid}-${hash}`;
}

const BOOKING_DETAIL_INCLUDE = {
  trip: true,
  itemRequest: true,
  sender: true,
  traveler: true,
  handoffLogs: true,
  messages: true,
  disputes: true,
} as const;

async function getBookingOrThrow(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: BOOKING_DETAIL_INCLUDE,
  });

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  return booking;
}

async function generateCustomsFormPdf(booking: {
  id: string;
  totalPriceUsd: number;
  itemRequest: { name: string; description: string; declaredValueUsd: number; recipientName: string; recipientAddress: string; recipientCountry: string };
  sender: { firstName: string; lastName: string };
  traveler: { firstName: string; lastName: string };
}): Promise<string> {
  const doc = new PDFDocument();
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  doc.fontSize(18).text("Customs Declaration Form", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Booking ID: ${booking.id}`);
  doc.text(`Sender: ${booking.sender.firstName} ${booking.sender.lastName}`);
  doc.text(`Traveler: ${booking.traveler.firstName} ${booking.traveler.lastName}`);
  doc.moveDown();
  doc.text(`Item: ${booking.itemRequest.name}`);
  doc.text(`Description: ${booking.itemRequest.description}`);
  doc.text(`Declared value: $${booking.itemRequest.declaredValueUsd.toFixed(2)}`);
  doc.moveDown();
  doc.text(`Recipient: ${booking.itemRequest.recipientName}`);
  doc.text(`Recipient address: ${booking.itemRequest.recipientAddress}`);
  doc.text(`Recipient country: ${booking.itemRequest.recipientCountry}`);

  doc.end();

  const buffer = await new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  return uploadToS3({
    key: `customs-forms/${booking.id}.pdf`,
    body: buffer,
    contentType: "application/pdf",
  });
}

export interface CreateBookingResult {
  booking: Booking;
  stripeClientSecret: string | null;
}

export async function createBooking(senderId: string, input: CreateBookingInput): Promise<CreateBookingResult> {
  const [trip, itemRequest, sender] = await Promise.all([
    prisma.trip.findUnique({ where: { id: input.tripId } }),
    prisma.itemRequest.findUnique({ where: { id: input.itemRequestId } }),
    prisma.user.findUnique({ where: { id: senderId } }),
  ]);

  if (!trip) {
    throw new NotFoundError("Trip not found");
  }
  if (!itemRequest) {
    throw new NotFoundError("Item request not found");
  }
  if (!sender) {
    throw new NotFoundError("Sender not found");
  }
  if (itemRequest.senderId !== senderId) {
    throw new ForbiddenError("You do not own this item request");
  }
  if (trip.status !== "ACTIVE") {
    throw new BadRequestError("Trip is not active");
  }
  if (trip.availableLbs < itemRequest.weightLbs) {
    throw new ConflictError("Trip does not have enough available capacity");
  }
  if (!trip.allowedCategories.includes(itemRequest.category)) {
    throw new BadRequestError("Item category is not allowed on this trip");
  }

  const totalPriceUsd = trip.pricePerLb * itemRequest.weightLbs;
  const platformFeeUsd = totalPriceUsd * PLATFORM_FEE_RATE;
  const travelerPayoutUsd = totalPriceUsd * TRAVELER_PAYOUT_RATE;
  const insuranceFeeUsd = input.hasInsurance ? INSURANCE_FEE_USD : 0;
  const qrSealCode = generateQrSealCode();

  const booking = await prisma.booking.create({
    data: {
      tripId: trip.id,
      itemRequestId: itemRequest.id,
      senderId,
      travelerId: trip.travelerId,
      agreedPricePerLb: trip.pricePerLb,
      totalPriceUsd,
      platformFeeUsd,
      travelerPayoutUsd,
      hasInsurance: input.hasInsurance,
      insuranceFeeUsd,
      qrSealCode,
      status: "PENDING_TRAVELER",
    },
  });

  await prisma.itemRequest.update({ where: { id: itemRequest.id }, data: { status: "MATCHED" } });

  try {
    const paymentIntent = await stripeService.createEscrowPaymentIntent({
      bookingId: booking.id,
      senderId,
      travelerId: trip.travelerId,
      amountUsd: totalPriceUsd + insuranceFeeUsd,
      stripeCustomerId: sender.stripeCustomerId,
    });

    const updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: { stripePaymentIntentId: paymentIntent.id },
    });

    await logAuditEvent({
      entity: ACTIVE_BOOKING_ENTITY,
      entityId: booking.id,
      action: "CREATED",
      toStatus: "PENDING_TRAVELER",
      performedByUserId: senderId,
    });

    await notificationService.sendBookingRequest(trip.travelerId, updatedBooking);

    return { booking: updatedBooking, stripeClientSecret: paymentIntent.client_secret };
  } catch (error) {
    await prisma.booking.delete({ where: { id: booking.id } });
    await prisma.itemRequest.update({ where: { id: itemRequest.id }, data: { status: "PENDING" } });
    throw new BadRequestError("Failed to create payment for this booking");
  }
}

export async function acceptBooking(bookingId: string, travelerId: string): Promise<Booking> {
  const booking = await getBookingOrThrow(bookingId);

  if (booking.travelerId !== travelerId) {
    throw new ForbiddenError("You are not the traveler for this booking");
  }
  if (booking.status !== "PENDING_TRAVELER") {
    throw new BadRequestError("Booking is not pending traveler acceptance");
  }
  if (!booking.stripePaymentIntentId) {
    throw new BadRequestError("Booking has no payment intent");
  }

  await stripeService.captureEscrowPaymentIntent(booking.stripePaymentIntentId, booking.id);

  const customsFormUrl = await generateCustomsFormPdf(booking);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.trip.update({
      where: { id: booking.tripId },
      data: { availableLbs: { decrement: booking.itemRequest.weightLbs } },
    });

    return tx.booking.update({
      where: { id: booking.id },
      data: {
        status: "ACCEPTED",
        escrowStatus: "HELD",
        travelerAcceptedAt: new Date(),
        customsFormUrl,
      },
    });
  });

  await logAuditEvent({
    entity: ACTIVE_BOOKING_ENTITY,
    entityId: booking.id,
    action: "ACCEPTED",
    fromStatus: "PENDING_TRAVELER",
    toStatus: "ACCEPTED",
    performedByUserId: travelerId,
  });

  emitToBooking(booking.id, "booking_status_changed", { bookingId: booking.id, newStatus: "ACCEPTED" });

  await notificationService.sendBookingAccepted(booking.senderId, updated);
  await notificationService.sendPaymentHeld(booking.senderId, booking.totalPriceUsd + booking.insuranceFeeUsd);

  return updated;
}

export async function rejectBooking(bookingId: string, travelerId: string): Promise<Booking> {
  const booking = await getBookingOrThrow(bookingId);

  if (booking.travelerId !== travelerId) {
    throw new ForbiddenError("You are not the traveler for this booking");
  }
  if (booking.status !== "PENDING_TRAVELER") {
    throw new BadRequestError("Booking is not pending traveler acceptance");
  }

  if (booking.stripePaymentIntentId) {
    await stripeService.cancelEscrowPaymentIntent(booking.stripePaymentIntentId, booking.id);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.itemRequest.update({ where: { id: booking.itemRequestId }, data: { status: "PENDING" } });
    return tx.booking.update({
      where: { id: booking.id },
      data: { status: "REJECTED", escrowStatus: "REFUNDED" },
    });
  });

  await logAuditEvent({
    entity: ACTIVE_BOOKING_ENTITY,
    entityId: booking.id,
    action: "REJECTED",
    fromStatus: "PENDING_TRAVELER",
    toStatus: "REJECTED",
    performedByUserId: travelerId,
  });

  emitToBooking(booking.id, "booking_status_changed", { bookingId: booking.id, newStatus: "REJECTED" });

  await notificationService.sendToUser(booking.senderId, {
    title: "Booking rejected",
    body: "Your traveler rejected the booking. You have been refunded.",
    data: { bookingId: booking.id },
  });

  return updated;
}

export async function reportItemPosted(
  bookingId: string,
  senderId: string,
  input: ItemPostedInput,
): Promise<Booking> {
  const booking = await getBookingOrThrow(bookingId);

  if (booking.senderId !== senderId) {
    throw new ForbiddenError("You are not the sender for this booking");
  }
  if (booking.status !== "ACCEPTED") {
    throw new BadRequestError("Booking must be accepted before posting the item");
  }

  await prisma.handoffLog.create({
    data: {
      bookingId: booking.id,
      stage: "SENDER_POSTED",
      photoUrls: input.photoUrls,
      performedByUserId: senderId,
    },
  });

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { itemPostedAt: new Date() },
  });

  await prisma.itemRequest.update({
    where: { id: booking.itemRequestId },
    data: { trackingNumber: input.trackingNumber },
  });

  await logAuditEvent({
    entity: ACTIVE_BOOKING_ENTITY,
    entityId: booking.id,
    action: "ITEM_POSTED",
    performedByUserId: senderId,
  });

  await notificationService.sendItemPosted(booking.travelerId, input.trackingNumber);

  return updated;
}

export async function confirmPickup(
  bookingId: string,
  travelerId: string,
  input: PickupConfirmedInput,
): Promise<Booking> {
  const booking = await getBookingOrThrow(bookingId);

  if (booking.travelerId !== travelerId) {
    throw new ForbiddenError("You are not the traveler for this booking");
  }
  if (booking.status !== "ACCEPTED") {
    throw new BadRequestError("Booking must be accepted before confirming pickup");
  }

  if (input.scannedQrCode !== booking.qrSealCode) {
    await logAuditEvent({
      entity: ACTIVE_BOOKING_ENTITY,
      entityId: booking.id,
      action: "QR_MISMATCH_PICKUP",
      performedByUserId: travelerId,
    });

    await Promise.all([
      notificationService.sendToUser(booking.senderId, {
        title: "QR code mismatch",
        body: "The QR code scanned at pickup did not match. This booking has been flagged for review.",
        data: { bookingId: booking.id },
      }),
      notificationService.sendToUser(booking.travelerId, {
        title: "QR code mismatch",
        body: "The QR code you scanned did not match. This booking has been flagged for review.",
        data: { bookingId: booking.id },
      }),
    ]);

    throw new BadRequestError("Scanned QR code does not match the booking seal code");
  }

  await prisma.handoffLog.create({
    data: {
      bookingId: booking.id,
      stage: "TRAVELER_PICKUP",
      photoUrls: input.photoUrls,
      scannedQrCode: input.scannedQrCode,
      performedByUserId: travelerId,
      latitude: input.latitude,
      longitude: input.longitude,
    },
  });

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { itemPickedUpAt: new Date() },
  });

  await prisma.itemRequest.update({ where: { id: booking.itemRequestId }, data: { status: "IN_TRANSIT" } });

  await logAuditEvent({
    entity: ACTIVE_BOOKING_ENTITY,
    entityId: booking.id,
    action: "PICKUP_CONFIRMED",
    performedByUserId: travelerId,
  });

  emitToBooking(booking.id, "qr_scanned", {
    bookingId: booking.id,
    stage: "TRAVELER_PICKUP",
    timestamp: new Date(),
  });

  await notificationService.sendQrScanned(booking.senderId, "TRAVELER_PICKUP");

  return updated;
}

export async function confirmDelivery(
  bookingId: string,
  performedByUserId: string,
  input: DeliveryConfirmedInput,
): Promise<Booking> {
  const booking = await getBookingOrThrow(bookingId);

  if (booking.status !== "ACCEPTED" && booking.status !== "ACTIVE") {
    throw new BadRequestError("Booking is not in a state that allows delivery confirmation");
  }

  if (input.scannedQrCode !== booking.qrSealCode) {
    await logAuditEvent({
      entity: ACTIVE_BOOKING_ENTITY,
      entityId: booking.id,
      action: "QR_MISMATCH_DELIVERY",
      performedByUserId,
    });

    await Promise.all([
      notificationService.sendToUser(booking.senderId, {
        title: "QR code mismatch",
        body: "The QR code scanned at delivery did not match. This booking has been flagged for review.",
        data: { bookingId: booking.id },
      }),
      notificationService.sendToUser(booking.travelerId, {
        title: "QR code mismatch",
        body: "The QR code scanned at delivery did not match. This booking has been flagged for review.",
        data: { bookingId: booking.id },
      }),
    ]);

    throw new BadRequestError("Scanned QR code does not match the booking seal code");
  }

  const signatureUrl = await uploadToS3({
    key: `signatures/${booking.id}-${Date.now()}.txt`,
    body: Buffer.from(input.recipientSignature, "base64"),
    contentType: "image/png",
  });

  await prisma.handoffLog.create({
    data: {
      bookingId: booking.id,
      stage: "RECIPIENT_CONFIRMED",
      photoUrls: input.photoUrls,
      scannedQrCode: input.scannedQrCode,
      signatureUrl,
      performedByUserId,
      latitude: input.latitude,
      longitude: input.longitude,
    },
  });

  if (!booking.traveler.stripeAccountId) {
    throw new BadRequestError("Traveler has no connected Stripe account for payout");
  }

  const transfer = await stripeService.releaseEscrowToTraveler({
    bookingId: booking.id,
    travelerStripeAccountId: booking.traveler.stripeAccountId,
    amountUsd: booking.travelerPayoutUsd,
  });

  const updated = await prisma.$transaction(async (tx) => {
    await tx.itemRequest.update({ where: { id: booking.itemRequestId }, data: { status: "DELIVERED" } });

    await tx.user.update({ where: { id: booking.travelerId }, data: { totalTrips: { increment: 1 } } });
    await tx.user.update({ where: { id: booking.senderId }, data: { totalDeliveries: { increment: 1 } } });

    return tx.booking.update({
      where: { id: booking.id },
      data: {
        status: "COMPLETED",
        escrowStatus: "RELEASED",
        deliveredAt: new Date(),
        stripeTransferId: transfer.id,
      },
    });
  });

  await logAuditEvent({
    entity: ACTIVE_BOOKING_ENTITY,
    entityId: booking.id,
    action: "DELIVERY_CONFIRMED",
    fromStatus: booking.status,
    toStatus: "COMPLETED",
    performedByUserId,
  });

  emitToBooking(booking.id, "qr_scanned", {
    bookingId: booking.id,
    stage: "RECIPIENT_CONFIRMED",
    timestamp: new Date(),
  });
  emitToBooking(booking.id, "booking_status_changed", { bookingId: booking.id, newStatus: "COMPLETED" });

  await Promise.all([
    notificationService.sendToUser(booking.senderId, {
      title: "Delivery confirmed",
      body: "Your item has been delivered. Please leave a review for your traveler.",
      data: { bookingId: booking.id },
    }),
    notificationService.sendDeliveryConfirmed(booking.travelerId, booking.travelerPayoutUsd),
    notificationService.sendPayoutSent(booking.travelerId, booking.travelerPayoutUsd),
  ]);

  return updated;
}

export async function openDispute(bookingId: string, openedByUserId: string, input: DisputeInput) {
  const booking = await getBookingOrThrow(bookingId);

  if (booking.senderId !== openedByUserId && booking.travelerId !== openedByUserId) {
    throw new ForbiddenError("You are not a party to this booking");
  }

  const dispute = await prisma.dispute.create({
    data: {
      bookingId: booking.id,
      openedByUserId,
      reason: input.reason,
      description: input.description,
      evidenceUrls: input.evidenceUrls,
      status: "OPEN",
    },
  });

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: "DISPUTED",
      ...(booking.escrowStatus === "HELD" ? { escrowStatus: "FROZEN" } : {}),
    },
  });

  await logAuditEvent({
    entity: ACTIVE_BOOKING_ENTITY,
    entityId: booking.id,
    action: "DISPUTE_OPENED",
    fromStatus: booking.status,
    toStatus: "DISPUTED",
    performedByUserId: openedByUserId,
    metadata: { disputeId: dispute.id, reason: input.reason },
  });

  emitToBooking(booking.id, "booking_status_changed", { bookingId: booking.id, newStatus: "DISPUTED" });

  await Promise.all([
    notificationService.sendDisputeOpened(booking.senderId, dispute.id),
    notificationService.sendDisputeOpened(booking.travelerId, dispute.id),
  ]);

  return dispute;
}

export async function getMyBookings(userId: string) {
  return prisma.booking.findMany({
    where: { OR: [{ senderId: userId }, { travelerId: userId }] },
    include: BOOKING_DETAIL_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

export async function getBookingDetail(bookingId: string) {
  return getBookingOrThrow(bookingId);
}

export async function handlePaymentFailed(paymentIntentId: string): Promise<void> {
  const booking = await prisma.booking.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
    include: BOOKING_DETAIL_INCLUDE,
  });

  if (!booking) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
    await tx.itemRequest.update({ where: { id: booking.itemRequestId }, data: { status: "PENDING" } });
  });

  await logAuditEvent({
    entity: ACTIVE_BOOKING_ENTITY,
    entityId: booking.id,
    action: "PAYMENT_FAILED",
    fromStatus: booking.status,
    toStatus: "CANCELLED",
  });

  emitToBooking(booking.id, "booking_status_changed", { bookingId: booking.id, newStatus: "CANCELLED" });

  await notificationService.sendToUser(booking.senderId, {
    title: "Payment failed",
    body: "Your payment for this booking failed and the booking has been cancelled.",
    data: { bookingId: booking.id },
  });
}

export async function handleTransferFailed(transferId: string): Promise<void> {
  const booking = await prisma.booking.findFirst({
    where: { stripeTransferId: transferId },
    include: BOOKING_DETAIL_INCLUDE,
  });

  if (!booking) {
    return;
  }

  if (!booking.traveler.stripeAccountId) {
    return;
  }

  try {
    const retryTransfer = await stripeService.releaseEscrowToTraveler({
      bookingId: booking.id,
      travelerStripeAccountId: booking.traveler.stripeAccountId,
      amountUsd: booking.travelerPayoutUsd,
      idempotencyKeyOverride: `release-escrow-${booking.id}-retry-${Date.now()}`,
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { stripeTransferId: retryTransfer.id },
    });

    await logAuditEvent({
      entity: ACTIVE_BOOKING_ENTITY,
      entityId: booking.id,
      action: "TRANSFER_RETRY_SUCCEEDED",
    });
  } catch (error) {
    console.error("Retry of failed transfer also failed", error);

    await logAuditEvent({
      entity: ACTIVE_BOOKING_ENTITY,
      entityId: booking.id,
      action: "TRANSFER_RETRY_FAILED",
    });

    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (admin) {
      await notificationService.sendToUser(admin.id, {
        title: "Payout retry failed",
        body: `Payout retry failed for booking ${booking.id}. Manual intervention required.`,
        data: { bookingId: booking.id },
      });
    }
  }
}
