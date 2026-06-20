import RedisStore, { type RedisReply } from "rate-limit-redis";
import rateLimit, { type Options } from "express-rate-limit";
import { redis } from "../config/redis";

function redisStore(prefix: string) {
  return new RedisStore({
    prefix,
    sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as Promise<RedisReply>,
  });
}

function buildLimiter(prefix: string, windowMs: number, limit: number, overrides: Partial<Options> = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    store: redisStore(prefix),
    message: { error: { code: "RATE_LIMITED", message: "Too many requests, please try again later" } },
    ...overrides,
  });
}

export const loginRateLimiter = buildLimiter("rl:login:", 15 * 60 * 1000, 5);

export const registerRateLimiter = buildLimiter("rl:register:", 60 * 60 * 1000, 3);

export const createBookingRateLimiter = buildLimiter("rl:booking-create:", 60 * 60 * 1000, 10, {
  keyGenerator: (req) => req.user?.id ?? req.ip ?? "anonymous",
});

export const defaultRateLimiter = buildLimiter("rl:default:", 60 * 1000, 100, {
  keyGenerator: (req) => req.user?.id ?? req.ip ?? "anonymous",
});
