import { randomInt } from "crypto";
import type { UserRole } from "@prisma/client";
import { prisma } from "../config/prisma";
import { redis } from "../config/redis";
import { twilioClient } from "../config/twilio";
import { BadRequestError, ConflictError, UnauthorizedError } from "../utils/errors";
import {
  REFRESH_TOKEN_TTL_SECONDS,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import { hashPassword, comparePassword } from "../utils/password";
import { toPublicUser, type PublicUser } from "./user.service";

const OTP_TTL_SECONDS = 10 * 60;

export interface RegisterInput {
  email: string;
  phone?: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

function otpRedisKey(userId: string): string {
  return `otp:phone:${userId}`;
}

function revokedRefreshKey(jti: string): string {
  return `revoked:refresh:${jti}`;
}

async function sendPhoneOtp(userId: string, phone: string): Promise<void> {
  const otp = randomInt(100000, 1000000).toString().padStart(6, "0");
  await redis.set(otpRedisKey(userId), otp, "EX", OTP_TTL_SECONDS);

  await twilioClient.messages.create({
    to: phone,
    from: process.env.TWILIO_FROM_NUMBER,
    body: `Your LuggaLink verification code is ${otp}`,
  });
}

async function issueTokenPair(userId: string, role: UserRole): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = signAccessToken({ sub: userId, role });
  const { token: refreshToken } = signRefreshToken(userId);
  return { accessToken, refreshToken };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError("Email is already registered");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      phone: input.phone,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
    },
  });

  if (user.phone) {
    await sendPhoneOtp(user.id, user.phone);
  }

  const tokens = await issueTokenPair(user.id, user.role);
  return { user: toPublicUser(user), ...tokens };
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const isValidPassword = await comparePassword(password, user.passwordHash);
  if (!isValidPassword) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const tokens = await issueTokenPair(user.id, user.role);
  return { user: toPublicUser(user), ...tokens };
}

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }

  const isRevoked = await redis.exists(revokedRefreshKey(payload.jti));
  if (isRevoked) {
    throw new UnauthorizedError("Refresh token has been revoked");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    throw new UnauthorizedError("User no longer exists");
  }

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  return { accessToken };
}

export async function verifyPhone(userId: string, otp: string): Promise<PublicUser> {
  const storedOtp = await redis.get(otpRedisKey(userId));
  if (!storedOtp || storedOtp !== otp) {
    throw new BadRequestError("Invalid or expired verification code");
  }

  await redis.del(otpRedisKey(userId));

  const user = await prisma.user.update({
    where: { id: userId },
    data: { isPhoneVerified: true },
  });

  return toPublicUser(user);
}

export async function logout(refreshToken: string): Promise<void> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    return;
  }

  const expiresAt = payload.exp ?? Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL_SECONDS;
  const ttlSeconds = Math.max(expiresAt - Math.floor(Date.now() / 1000), 1);

  await redis.set(revokedRefreshKey(payload.jti), "1", "EX", ttlSeconds);
}
