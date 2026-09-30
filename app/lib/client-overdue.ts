import { businessDaysBetween, startOfBusinessDay } from "@/lib/business-time";

/**
 * Client-side overdue arithmetic.
 *
 * This mirrors lib/services/overdue.ts, which is the server's version. Both
 * exist because the dashboard is a client component and cannot import the
 * service module, but the rules must agree — a badge that disagrees with the
 * officer list it sits next to is worse than no badge.
 *
 * Two rules the earlier version of this file got wrong:
 *
 * 1. It counted days on the *host's* calendar. The host is not guaranteed to
 *    run on Philippine time, and a UTC container would report every booking a
 *    day early or late. Business days are resolved explicitly instead, so the
 *    badge matches the server regardless of how the box is configured.
 *
 * 2. It ignored `status`. A QUEUED request has not been picked up, so the
 *    member never had the machine and cannot be late returning it. Only a
 *    booking the member is actually holding can be overdue. The status list is
 *    spelled out as plain strings rather than imported from the Prisma enums,
 *    which would drag the query engine into the browser bundle;
 *    tests/overdue.test.ts asserts this list still matches
 *    MEMBER_RETURNABLE_MACHINE_STATUSES so the copy cannot drift.
 */
const RETURNABLE_MACHINE_STATUSES = ["IN_USE", "OVERDUE"];

export function daysBetween(from: Date, to: Date): number {
  return businessDaysBetween(from, to);
}

export interface MachineRequestShape {
  status: string;
  endDate: string | null;
  returnedAt: string | null;
}

export function isReturnableMachineStatus(status: string): boolean {
  return RETURNABLE_MACHINE_STATUSES.includes(status);
}

/**
 * Days a held booking is late, or 0 when it is not late. A booking due today
 * is not overdue: the day is not over yet.
 */
export function machineRequestOverdueDays(
  status: string,
  endDate: string | null | undefined,
  returnedAt: string | null | undefined,
  now: Date = new Date(),
): number {
  if (!isReturnableMachineStatus(status)) return 0;
  if (!endDate || returnedAt) return 0;
  if (startOfBusinessDay(new Date(endDate)).getTime() >= startOfBusinessDay(now).getTime()) {
    return 0;
  }
  return daysBetween(new Date(endDate), now);
}

export function isMachineRequestOverdue(
  status: string,
  endDate: string | null | undefined,
  returnedAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  return machineRequestOverdueDays(status, endDate, returnedAt, now) > 0;
}

export function machineActiveOverdueDays(
  requests: MachineRequestShape[] | undefined,
  now: Date = new Date(),
): number {
  return worstOverdueRequest(requests, now)?.overdueDays ?? 0;
}

/**
 * The single latest booking on a machine, so the card can name whose machine
 * it is. A machine card lists every member's bookings, so without this a
 * badge reports one member's overdue loan as if the machine itself were the
 * problem — and, worse, as if the reader were the one who had it.
 */
export function worstOverdueRequest<T extends MachineRequestShape>(
  requests: T[] | undefined,
  now: Date = new Date(),
): (T & { overdueDays: number }) | null {
  if (!requests) return null;
  let worst: (T & { overdueDays: number }) | null = null;
  for (const r of requests) {
    const days = machineRequestOverdueDays(r.status, r.endDate, r.returnedAt, now);
    if (days > 0 && (!worst || days > worst.overdueDays)) {
      worst = { ...r, overdueDays: days };
    }
  }
  return worst;
}

export const machineOverdueDays = machineActiveOverdueDays;

export function loanOverdueDays(
  due: string | null | undefined,
  now: Date = new Date(),
): number {
  if (!due) return 0;
  if (startOfBusinessDay(new Date(due)).getTime() >= startOfBusinessDay(now).getTime()) {
    return 0;
  }
  return daysBetween(new Date(due), now);
}

export function isLoanOverdue(
  status: string,
  due: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (status === "REJECTED" || status === "PAID") return false;
  return loanOverdueDays(due, now) > 0;
}
