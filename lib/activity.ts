import { Prisma } from "@/app/generated/prisma";
import prisma from "@/lib/client";

type TransactionClient = Prisma.TransactionClient;

export async function writeAudit(
  tx: TransactionClient,
  input: {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    metadata?: Prisma.InputJsonValue;
  },
) {
  return tx.auditTrail.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      metadata: input.metadata,
    },
  });
}

export async function notifyUser(
  tx: TransactionClient,
  input: {
    userId: string;
    title: string;
    message: string;
  },
) {
  return tx.notification.create({ data: input });
}

export async function writeActivityLog(input: {
  userId?: string;
  action: string;
  success: boolean;
  info: string;
}) {
  return prisma.log.create({ data: input });
}
