import { NotificationType, Prisma, Role } from "@/app/generated/prisma";
import prisma from "@/lib/client";

type TransactionClient = Prisma.TransactionClient;

export async function writeAudit(
  tx: TransactionClient,
  input: {
    userId?: string;
    userRole?: Role;
    action: string;
    entity: string;
    entityId?: string;
    previousStatus?: string;
    newStatus?: string;
    metadata?: Prisma.InputJsonValue;
  },
) {
  return tx.auditTrail.create({
    data: {
      userId: input.userId,
      userRole: input.userRole,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      previousStatus: input.previousStatus,
      newStatus: input.newStatus,
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
    type?: NotificationType;
    link?: string;
  },
) {
  return tx.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: input.type ?? NotificationType.GENERAL,
      link: input.link,
    },
  });
}

export async function writeActivityLog(input: {
  userId?: string;
  action: string;
  success: boolean;
  info: string;
}) {
  return prisma.log.create({ data: input });
}
