"use server";

import { revalidatePath } from "next/cache";
import { logAdminAction } from "../../../lib/audit";
import { getCurrentAdminId } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export async function approveTripAction(tripId: string) {
  const adminId = getCurrentAdminId();
  await prisma.trip.update({ where: { id: tripId }, data: { isFlagged: false, flagReason: null } });
  await logAdminAction({ adminId, action: "APPROVE_TRIP", targetId: tripId });
  revalidatePath("/trips");
}

export async function removeTripAction(tripId: string) {
  const adminId = getCurrentAdminId();
  await prisma.trip.update({ where: { id: tripId }, data: { status: "CANCELLED" } });
  await logAdminAction({ adminId, action: "REMOVE_TRIP", targetId: tripId });
  revalidatePath("/trips");
}
