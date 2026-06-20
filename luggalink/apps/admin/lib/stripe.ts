import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-04-10",
});

function toCents(amountUsd: number): number {
  return Math.round(amountUsd * 100);
}

export async function refundBookingPartial(input: {
  bookingId: string;
  paymentIntentId: string;
  amountUsd: number;
}): Promise<Stripe.Refund> {
  return stripe.refunds.create(
    {
      payment_intent: input.paymentIntentId,
      amount: toCents(input.amountUsd),
    },
    { idempotencyKey: `dispute-refund-${input.bookingId}` },
  );
}

export async function releaseEscrowPartial(input: {
  bookingId: string;
  travelerStripeAccountId: string;
  amountUsd: number;
}): Promise<Stripe.Transfer> {
  return stripe.transfers.create(
    {
      amount: toCents(input.amountUsd),
      currency: "usd",
      destination: input.travelerStripeAccountId,
      transfer_group: input.bookingId,
    },
    { idempotencyKey: `dispute-release-${input.bookingId}` },
  );
}
