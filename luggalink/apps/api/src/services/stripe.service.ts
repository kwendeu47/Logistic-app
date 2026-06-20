import type Stripe from "stripe";
import { stripe } from "../config/stripe";

export interface CreateEscrowPaymentIntentInput {
  bookingId: string;
  senderId: string;
  travelerId: string;
  amountUsd: number;
  stripeCustomerId?: string | null;
}

function toCents(amountUsd: number): number {
  return Math.round(amountUsd * 100);
}

export async function createEscrowPaymentIntent(
  input: CreateEscrowPaymentIntentInput,
): Promise<Stripe.PaymentIntent> {
  try {
    return await stripe.paymentIntents.create(
      {
        amount: toCents(input.amountUsd),
        currency: "usd",
        capture_method: "manual",
        customer: input.stripeCustomerId ?? undefined,
        metadata: {
          bookingId: input.bookingId,
          senderId: input.senderId,
          travelerId: input.travelerId,
        },
      },
      { idempotencyKey: `create-pi-${input.bookingId}` },
    );
  } catch (error) {
    console.error("Failed to create escrow PaymentIntent", error);
    throw error;
  }
}

export async function captureEscrowPaymentIntent(
  paymentIntentId: string,
  bookingId: string,
): Promise<Stripe.PaymentIntent> {
  try {
    return await stripe.paymentIntents.capture(paymentIntentId, undefined, {
      idempotencyKey: `capture-pi-${bookingId}`,
    });
  } catch (error) {
    console.error("Failed to capture escrow PaymentIntent", error);
    throw error;
  }
}

export async function cancelEscrowPaymentIntent(
  paymentIntentId: string,
  bookingId: string,
): Promise<Stripe.PaymentIntent> {
  try {
    return await stripe.paymentIntents.cancel(paymentIntentId, {
      idempotencyKey: `cancel-pi-${bookingId}`,
    });
  } catch (error) {
    console.error("Failed to cancel escrow PaymentIntent", error);
    throw error;
  }
}

export interface ReleaseEscrowInput {
  bookingId: string;
  travelerStripeAccountId: string;
  amountUsd: number;
  idempotencyKeyOverride?: string;
}

export async function releaseEscrowToTraveler(input: ReleaseEscrowInput): Promise<Stripe.Transfer> {
  try {
    return await stripe.transfers.create(
      {
        amount: toCents(input.amountUsd),
        currency: "usd",
        destination: input.travelerStripeAccountId,
        transfer_group: input.bookingId,
      },
      { idempotencyKey: input.idempotencyKeyOverride ?? `release-escrow-${input.bookingId}` },
    );
  } catch (error) {
    console.error("Failed to release escrow to traveler", error);
    throw error;
  }
}
