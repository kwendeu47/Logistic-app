"use server";

import { revalidatePath } from "next/cache";
import { logAdminAction } from "../../../lib/audit";
import { getCurrentAdminId } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export async function approveKycAction(userId: string) {
  const adminId = getCurrentAdminId();
  await prisma.user.update({
    where: { id: userId },
    data: { isIdVerified: true, isFaceVerified: true, kycStatus: "VERIFIED" },
  });
  await logAdminAction({ adminId, action: "KYC_APPROVE", targetId: userId });
  revalidatePath("/kyc");
}

export async function rejectKycAction(userId: string, reason: string) {
  const adminId = getCurrentAdminId();
  await prisma.user.update({
    where: { id: userId },
    data: { kycStatus: "REJECTED" },
  });
  await logAdminAction({ adminId, action: "KYC_REJECT", targetId: userId, metadata: { reason } });
  revalidatePath("/kyc");
}
