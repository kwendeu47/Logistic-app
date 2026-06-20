import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { softAuth } from "./middleware/auth";
import {
  createBookingRateLimiter,
  defaultRateLimiter,
  loginRateLimiter,
  registerRateLimiter,
} from "./middleware/rateLimit";
import { sanitizeInput } from "./middleware/sanitize";
import authRouter from "./routes/auth.routes";
import { bookingRouter, stripePaymentWebhookRouter } from "./routes/booking.routes";
import { documentsRouter } from "./routes/documents.routes";
import { healthRouter } from "./routes/health.routes";
import { expoReceiptWebhookRouter } from "./routes/expoWebhook.routes";
import { messageRouter } from "./routes/message.routes";
import { tripRouter } from "./routes/trip.routes";
import { stripeIdentityWebhookRouter, userRouter } from "./routes/user.routes";
import { errorHandler } from "./utils/errors";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
  app.use(cookieParser());

  app.use(
    "/webhooks/stripe-identity",
    express.raw({ type: "application/json" }),
    stripeIdentityWebhookRouter,
  );

  app.use(
    "/webhooks/stripe-payment",
    express.raw({ type: "application/json" }),
    stripePaymentWebhookRouter,
  );

  app.use("/webhooks/expo-receipts", express.json(), expoReceiptWebhookRouter);

  app.use(express.json());
  app.use(sanitizeInput);
  app.use(softAuth);

  app.use("/health", healthRouter);

  app.use("/auth/login", loginRateLimiter);
  app.use("/auth/register", registerRateLimiter);
  app.use("/bookings", (req, res, next) => {
    if (req.method === "POST" && req.path === "/") {
      createBookingRateLimiter(req, res, next);
      return;
    }
    next();
  });
  app.use(defaultRateLimiter);

  app.use("/auth", authRouter);
  app.use("/users", userRouter);
  app.use("/trips", tripRouter);
  app.use("/bookings", bookingRouter);
  app.use("/bookings", messageRouter);
  app.use("/bookings", documentsRouter);

  app.use(errorHandler);

  return app;
}
