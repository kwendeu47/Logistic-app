import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import authRouter from "./routes/auth.routes";
import { tripRouter } from "./routes/trip.routes";
import { stripeIdentityWebhookRouter, userRouter } from "./routes/user.routes";
import { errorHandler } from "./utils/errors";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
  app.use(cookieParser());

  app.use(
    "/webhooks/stripe-identity",
    express.raw({ type: "application/json" }),
    stripeIdentityWebhookRouter,
  );

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", authRouter);
  app.use("/users", userRouter);
  app.use("/trips", tripRouter);

  app.use(errorHandler);

  return app;
}
