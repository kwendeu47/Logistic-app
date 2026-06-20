import { prisma } from "./prisma";

export async function logAdminAction(input: {
  adminId: string;
  action: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.adminAuditLog.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      targetId: input.targetId,
      metadata: input.metadata as never,
    },
  });
}
