import { Prisma, Role } from "@/app/generated/prisma";

/**
 * The pure half of the account deactivation/reactivation feature.
 *
 * Account state is not stored in its own column: it is folded out of the audit
 * trail, which is where a transition is already required to be recorded and
 * where the officer's reason belongs. Keeping the fold separate from the
 * database means the rule that decides "is this request still open?" can be
 * tested directly, without standing up a database.
 */

/**
 * Account deactivation and reactivation.
 *
 * A disabled member keeps a valid session but loses all access, so they need a
 * way to ask for their account back and officers need a way to answer. The
 * cooperatively correct place for that state is the audit trail: every
 * transition is already required to be recorded there, and it is the only
 * durable, append-only record of *why* an account was disabled. Deriving the
 * current state from it keeps the trail and the UI from ever disagreeing.
 *
 * Three events, all scoped to entity "User" with entityId = member id:
 *   MEMBER_DEACTIVATED       an officer disabled the account
 *   REACTIVATION_REQUESTED   the member asked for it back
 *   MEMBER_REACTIVATED       an officer restored the account
 *
 * The newest of the three decides where the account stands. A request is open
 * when the newest is REACTIVATION_REQUESTED — it closes on its own the moment
 * the account is reactivated, so officers never have to dismiss it by hand.
 */

export const ACCOUNT_EVENTS = {
  deactivated: "MEMBER_DEACTIVATED",
  reactivationRequested: "REACTIVATION_REQUESTED",
  reactivated: "MEMBER_REACTIVATED",
} as const;

const ACCOUNT_EVENT_ACTIONS = [
  ACCOUNT_EVENTS.deactivated,
  ACCOUNT_EVENTS.reactivationRequested,
  ACCOUNT_EVENTS.reactivated,
] as const;

/** Officers who answer reactivation requests. */
export const REACTIVATION_REVIEW_ROLES = [Role.PRESIDENT, Role.SECRETARY] as const;

export const MAX_DEACTIVATION_REASON = 500;

export interface AccountEvent {
  action: string;
  createdAt: Date;
  metadata: Prisma.JsonValue;
}

export interface AccountStatus {
  /** The member asked to be reactivated and has not been answered yet. */
  openReactivationRequest: { at: Date; message: string | null } | null;
  /** The officer's stated reason for the most recent deactivation. */
  deactivationReason: string | null;
  deactivatedAt: Date | null;
}

function readString(metadata: Prisma.JsonValue, key: string): string | null {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    return null;
  }
  const value = (metadata as Record<string, unknown>)[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function messageFromEvent(event: AccountEvent): string | null {
  return (
    readString(event.metadata, "message") ?? readString(event.metadata, "reason")
  );
}

/**
 * Folds a member's account events, newest first, into the state the UI shows.
 *
 * Exported for testing: the folding rule is the whole feature, and it is much
 * easier to pin down as a pure function than through a route handler.
 */
export function summarizeAccountEvents(
  events: AccountEvent[],
): AccountStatus {
  const ordered = [...events].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const latestDeactivation = ordered.find(
    (event) => event.action === ACCOUNT_EVENTS.deactivated,
  );

  return {
    openReactivationRequest:
      ordered[0]?.action === ACCOUNT_EVENTS.reactivationRequested
        ? {
            at: ordered[0].createdAt,
            message: messageFromEvent(ordered[0]),
          }
        : null,
    deactivationReason: latestDeactivation
      ? readString(latestDeactivation.metadata, "reason")
      : null,
    deactivatedAt: latestDeactivation?.createdAt ?? null,
  };
}

export const emptyAccountStatus: AccountStatus = {
  openReactivationRequest: null,
  deactivationReason: null,
  deactivatedAt: null,
};
