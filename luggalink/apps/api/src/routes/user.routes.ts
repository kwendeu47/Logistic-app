import { Router } from "express";
import type Stripe from "stripe";
import { z } from "zod";
import { stripe } from "../config/stripe";
import { requireAuth } from "../middleware/auth";
import { attachUploadedImageUrl, uploadSingleImage, verifyUploadedFiles } from "../middleware/upload";
import { validate } from "../middleware/validate";
import * as userService from "../services/user.service";
import { BadRequestError } from "../utils/errors";

export const userRouter = Router();

userRouter.get("/me", requireAuth, async (req, res) => {
  const user = await userService.getUserById(req.user!.id);
  res.json({ user });
});

const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  avatarUrl: z.string().url().optional(),
});

userRouter.patch(
  "/me",
  requireAuth,
  uploadSingleImage.single("avatar"),
  verifyUploadedFiles(),
  attachUploadedImageUrl("avatars", "avatarUrl"),
  validate(updateProfileSchema),
  async (req, res) => {
    const user = await userService.updateProfile(req.user!.id, req.body);
    res.json({ user });
  },
);

userRouter.post("/me/kyc-session", requireAuth, async (req, res) => {
  const session = await userService.createKycSession(req.user!.id);
  res.json(session);
});

const deviceTokenSchema = z.object({
  expoPushToken: z.string().min(1),
  platform: z.enum(["ios", "android"]),
});

userRouter.post(
  "/me/device-token",
  requireAuth,
  validate(deviceTokenSchema),
  async (req, res) => {
    const device = await userService.registerDeviceToken(req.user!.id, req.body);
    res.json({ device });
  },
);

export const stripeIdentityWebhookRouter = Router();

stripeIdentityWebhookRouter.post("/", (req, res) => {
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") {
    throw new BadRequestError("Missing Stripe signature header");
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  const event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);

  res.json({ received: true });

  void processIdentityWebhookEvent(event);
});

async function processIdentityWebhookEvent(event: Stripe.Event): Promise<void> {
  try {
    if (event.type === "identity.verification_session.verified") {
      const session = event.data.object as Stripe.Identity.VerificationSession;
      await userService.handleIdentityVerified(session);
    }

    if (event.type === "identity.verification_session.requires_input") {
      const session = event.data.object as Stripe.Identity.VerificationSession;
      await userService.handleIdentityRequiresInput(session);
    }
  } catch (error) {
    console.error(`Failed to process Stripe identity webhook event ${event.id}`, error);
  }
}
