import { Router } from "express";
import type Stripe from "stripe";
import { stripe } from "../config/stripe";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import * as bookingService from "../services/booking.service";
import { BadRequestError } from "../utils/errors";

export const bookingRouter = Router();

bookingRouter.post(
  "/",
  requireAuth,
  validate(bookingService.createBookingSchema),
  async (req, res) => {
    const result = await bookingService.createBooking(req.user!.id, req.body);
    res.status(201).json(result);
  },
);

bookingRouter.get("/me", requireAuth, async (req, res) => {
  const bookings = await bookingService.getMyBookings(req.user!.id);
  res.json({ bookings });
});

bookingRouter.post("/:id/accept", requireAuth, async (req, res) => {
  const booking = await bookingService.acceptBooking(String(req.params.id), req.user!.id);
  res.json({ booking });
});

bookingRouter.post("/:id/reject", requireAuth, async (req, res) => {
  const booking = await bookingService.rejectBooking(String(req.params.id), req.user!.id);
  res.json({ booking });
});

bookingRouter.post(
  "/:id/item-posted",
  requireAuth,
  validate(bookingService.itemPostedSchema),
  async (req, res) => {
    const booking = await bookingService.reportItemPosted(String(req.params.id), req.user!.id, req.body);
    res.json({ booking });
  },
);

bookingRouter.post(
  "/:id/pickup-confirmed",
  requireAuth,
  validate(bookingService.pickupConfirmedSchema),
  async (req, res) => {
    const booking = await bookingService.confirmPickup(String(req.params.id), req.user!.id, req.body);
    res.json({ booking });
  },
);

bookingRouter.post(
  "/:id/delivery-confirmed",
  requireAuth,
  validate(bookingService.deliveryConfirmedSchema),
  async (req, res) => {
    const booking = await bookingService.confirmDelivery(String(req.params.id), req.user!.id, req.body);
    res.json({ booking });
  },
);

bookingRouter.post(
  "/:id/dispute",
  requireAuth,
  validate(bookingService.disputeSchema),
  async (req, res) => {
    const dispute = await bookingService.openDispute(String(req.params.id), req.user!.id, req.body);
    res.status(201).json({ dispute });
  },
);

bookingRouter.get("/:id", requireAuth, async (req, res) => {
  const booking = await bookingService.getBookingDetail(String(req.params.id));
  res.json({ booking });
});

export const stripePaymentWebhookRouter = Router();

stripePaymentWebhookRouter.post("/", (req, res) => {
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") {
    throw new BadRequestError("Missing Stripe signature header");
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  const event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);

  res.json({ received: true });

  void processPaymentWebhookEvent(event);
});

async function processPaymentWebhookEvent(event: Stripe.Event): Promise<void> {
  try {
    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await bookingService.handlePaymentFailed(paymentIntent.id);
    }

    if ((event.type as string) === "transfer.failed") {
      const transfer = event.data.object as unknown as Stripe.Transfer;
      await bookingService.handleTransferFailed(transfer.id);
    }
  } catch (error) {
    console.error(`Failed to process Stripe webhook event ${event.id}`, error);
  }
}
