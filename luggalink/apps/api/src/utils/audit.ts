import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export interface LogAuditEventInput {
  entity: string;
  entityId: string;
  action: string;
  fromStatus?: string;
  toStatus?: string;
  performedByUserId?: string;
  metadata?: Record<string, unknown>;
}

export async function logAuditEvent(input: LogAuditEventInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      entity: input.entity,
      entityId: input.entityId,
      action: input.action,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      performedByUserId: input.performedByUserId,
      ...(input.metadata ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
    },
  });
}
