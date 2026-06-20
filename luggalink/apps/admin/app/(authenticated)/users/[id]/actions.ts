"use server";

import { revalidatePath } from "next/cache";
import { logAdminAction } from "../../../../lib/audit";
import { getCurrentAdminId } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function toggleSuspendAction(userId: string, suspend: boolean) {
  const adminId = getCurrentAdminId();
  await prisma.user.update({ where: { id: userId }, data: { isSuspended: suspend } });
  await logAdminAction({
    adminId,
    action: suspend ? "SUSPEND_USER" : "UNSUSPEND_USER",
    targetId: userId,
  });
  revalidatePath(`/users/${userId}`);
}

export async function adjustTrustScoreAction(userId: string, newScore: number, reason: string) {
  const adminId = getCurrentAdminId();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await prisma.user.update({ where: { id: userId }, data: { trustScore: newScore } });
  await logAdminAction({
    adminId,
    action: "ADJUST_TRUST_SCORE",
    targetId: userId,
    metadata: { previousScore: user.trustScore, newScore, reason },
  });
  revalidatePath(`/users/${userId}`);
}

export async function forceVerifyAction(userId: string) {
  const adminId = getCurrentAdminId();
  await prisma.user.update({
    where: { id: userId },
    data: { isIdVerified: true, isFaceVerified: true, isPhoneVerified: true, kycStatus: "VERIFIED" },
  });
  await logAdminAction({ adminId, action: "FORCE_VERIFY_USER", targetId: userId });
  revalidatePath(`/users/${userId}`);
}
