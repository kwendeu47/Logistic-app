import { Router } from "express";
import type Stripe from "stripe";
import { z } from "zod";
import { stripe } from "../config/stripe";
import { requireAuth } from "../middleware/auth";
import { attachUploadedImageUrl, uploadSingleImage } from "../middleware/upload";
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

export const stripeIdentityWebhookRouter = Router();

stripeIdentityWebhookRouter.post("/", async (req, res) => {
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") {
    throw new BadRequestError("Missing Stripe signature header");
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  const event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);

  if (event.type === "identity.verification_session.verified") {
    const session = event.data.object as Stripe.Identity.VerificationSession;
    await userService.handleIdentityVerified(session);
  }

  res.json({ received: true });
});
