import { Router } from "express";
import { prisma } from "../config/prisma";
import { redis } from "../config/redis";
import { stripe } from "../config/stripe";

export const healthRouter = Router();

async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

async function checkStripe(): Promise<boolean> {
  try {
    await stripe.balance.retrieve();
    return true;
  } catch {
    return false;
  }
}

healthRouter.get("/", async (_req, res) => {
  const [database, cache, paymentProvider] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkStripe(),
  ]);

  const healthy = database && cache && paymentProvider;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    checks: { database, cache, paymentProvider },
  });
});
