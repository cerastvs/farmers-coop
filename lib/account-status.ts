import { NotificationType, Prisma, Role } from "@/app/generated/prisma";

import {
  ACCOUNT_EVENTS,
  REACTIVATION_REVIEW_ROLES,
  emptyAccountStatus,
  summarizeAccountEvents,
  type AccountEvent,
  type AccountStatus,
} from "@/lib/account-status-core";
import { notifyUser, writeAudit } from "@/lib/activity";
import prisma from "@/lib/client";
import { ApiError } from "@/lib/errors";

export {
  ACCOUNT_EVENTS,
  emptyAccountStatus,
  MAX_DEACTIVATION_REASON,
  REACTIVATION_REVIEW_ROLES,
  summarizeAccountEvents,
  type AccountEvent,
  type AccountStatus,
} from "@/lib/account-status-core";

type TransactionClient = Prisma.TransactionClient;

const ACCOUNT_EVENT_ACTIONS = [
  ACCOUNT_EVENTS.deactivated,
  ACCOUNT_EVENTS.reactivationRequested,
  ACCOUNT_EVENTS.reactivated,
] as const;

/**
 * Loads account status for many members at once. Officers list members in
 * bulk, so this takes ids and returns a map rather than querying per row.
 */
export async function loadAccountStatus(
  memberIds: string[],
): Promise<Map<string, AccountStatus>> {
  const statuses = new Map<string, AccountStatus>();
  if (memberIds.length === 0) return statuses;

  const events = await prisma.auditTrail.findMany({
    where: {
      entity: "User",
      entityId: { in: memberIds },
      action: { in: [...ACCOUNT_EVENT_ACTIONS] },
    },
    orderBy: { createdAt: "desc" },
    select: { entityId: true, action: true, createdAt: true, metadata: true },
  });

  const grouped = new Map<string, AccountEvent[]>();
  for (const event of events) {
    if (!event.entityId) continue;
    const bucket = grouped.get(event.entityId) ?? [];
    bucket.push(event);
    grouped.set(event.entityId, bucket);
  }

  for (const id of memberIds) {
    statuses.set(id, summarizeAccountEvents(grouped.get(id) ?? []));
  }
  return statuses;
}

export async function getAccountStatus(
  memberId: string,
): Promise<AccountStatus> {
  const statuses = await loadAccountStatus([memberId]);
  return statuses.get(memberId) ?? emptyAccountStatus;
}

/**
 * Records an officer disabling an account, along with the optional reason the
 * member will later be shown.
 *
 * Called from the shared member-record update so the members directory and the
 * administrative actions panel both produce identical audit trails.
 */
export async function recordDeactivation(
  tx: TransactionClient,
  {
    actorId,
    actorRole,
    memberId,
    reason,
  }: {
    actorId: string;
    actorRole: Role;
    memberId: string;
    reason?: string | null;
  },
) {
  const trimmed = reason?.trim() ?? "";
  await writeAudit(tx, {
    userId: actorId,
    userRole: actorRole,
    action: ACCOUNT_EVENTS.deactivated,
    entity: "User",
    entityId: memberId,
    previousStatus: "ACTIVE",
    newStatus: "INACTIVE",
    metadata: trimmed.length > 0 ? { reason: trimmed } : {},
  });
}

export async function recordReactivation(
  tx: TransactionClient,
  {
    actorId,
    actorRole,
    memberId,
  }: {
    actorId: string;
    actorRole: Role;
    memberId: string;
  },
) {
  await writeAudit(tx, {
    userId: actorId,
    userRole: actorRole,
    action: ACCOUNT_EVENTS.reactivated,
    entity: "User",
    entityId: memberId,
    previousStatus: "INACTIVE",
    newStatus: "ACTIVE",
  });
}

/**
 * A disabled member asks for their account back.
 *
 * Idempotent by design: a member who clicks twice must not spam the President
 * and Secretary, so an already-open request is reported rather than re-sent.
 */
export async function requestReactivation({
  memberId,
  message,
}: {
  memberId: string;
  message?: string | null;
}) {
  const trimmed = message?.trim() ?? "";

  return prisma.$transaction(
    async (tx) => {
      const member = await tx.user.findUnique({
        where: { id: memberId },
        select: { id: true, active: true, role: true, name: true, username: true },
      });
      if (!member) throw new ApiError(404, "Account not found");
      if (member.active) {
        throw new ApiError(409, "This account is already active");
      }

      const status = await getAccountStatusInTx(tx, memberId);
      if (status.openReactivationRequest) {
        return { alreadyRequested: true as const, requestedAt: status.openReactivationRequest.at };
      }

      const officers = await tx.user.findMany({
        where: {
          role: { in: [...REACTIVATION_REVIEW_ROLES] },
          active: true,
        },
        select: { id: true },
      });

      await writeAudit(tx, {
        userId: memberId,
        userRole: member.role,
        action: ACCOUNT_EVENTS.reactivationRequested,
        entity: "User",
        entityId: memberId,
        previousStatus: "INACTIVE",
        newStatus: "INACTIVE",
        metadata: trimmed.length > 0 ? { message: trimmed } : {},
      });

      const who = member.name ?? member.username;
      for (const officer of officers) {
        await notifyUser(tx, {
          userId: officer.id,
          title: "Reactivation request",
          message:
            `${who} (@${member.username}) is asking for their account to be reactivated.` +
            (status.deactivationReason
              ? ` Reason given when disabled: ${status.deactivationReason}`
              : "") +
            (trimmed.length > 0 ? ` Member's note: ${trimmed}` : ""),
          type: NotificationType.GENERAL,
          link: "/admin?tab=members",
        });
      }

      return { alreadyRequested: false as const, notified: officers.length };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

/** Reactivation-status read used inside a transaction. */
async function getAccountStatusInTx(
  tx: TransactionClient,
  memberId: string,
): Promise<AccountStatus> {
  const events = await tx.auditTrail.findMany({
    where: {
      entity: "User",
      entityId: memberId,
      action: { in: [...ACCOUNT_EVENT_ACTIONS] },
    },
    orderBy: { createdAt: "desc" },
    select: { action: true, createdAt: true, metadata: true },
  });
  return summarizeAccountEvents(events);
}
