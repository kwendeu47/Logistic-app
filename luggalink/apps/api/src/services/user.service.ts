import type { User, UserDevice } from "@prisma/client";
import type Stripe from "stripe";
import { prisma } from "../config/prisma";
import { stripe } from "../config/stripe";
import { NotFoundError } from "../utils/errors";

export type PublicUser = Omit<User, "passwordHash">;

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

export async function getUserById(id: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundError("User not found");
  }
  return toPublicUser(user);
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

export async function updateProfile(id: string, data: UpdateProfileInput): Promise<PublicUser> {
  const user = await prisma.user.update({ where: { id }, data });
  return toPublicUser(user);
}

export interface KycSession {
  clientSecret: string | null;
  url: string | null;
}

export async function createKycSession(userId: string): Promise<KycSession> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const session = await stripe.identity.verificationSessions.create({
    type: "document",
    metadata: { userId },
    options: { document: { require_matching_selfie: true } },
  });

  return { clientSecret: session.client_secret, url: session.url ?? null };
}

export interface RegisterDeviceTokenInput {
  expoPushToken: string;
  platform: "ios" | "android";
}

export async function registerDeviceToken(
  userId: string,
  input: RegisterDeviceTokenInput,
): Promise<UserDevice> {
  return prisma.userDevice.upsert({
    where: { expoPushToken: input.expoPushToken },
    create: { userId, expoPushToken: input.expoPushToken, platform: input.platform },
    update: { userId, platform: input.platform },
  });
}

export async function handleIdentityVerified(
  session: Stripe.Identity.VerificationSession,
): Promise<void> {
  const userId = session.metadata?.userId;
  if (!userId) {
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isIdVerified: true, isFaceVerified: true },
  });
}
