import { LoanStatus, MachineStatus, Prisma } from "@/app/generated/prisma";
import { notifyUser, writeAudit } from "@/lib/activity";
import { ApiError } from "@/lib/errors";

const BLOCKING_MACHINE_STATUSES = [
  MachineStatus.APPROVED,
  MachineStatus.IN_USE,
  MachineStatus.OVERDUE,
];

function toDayStart(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns the number of full days between two dates (positive if `from` is
 * before `to`). Used to compute "days overdue".
 */
export function daysBetween(from: Date, to: Date) {
  const ms = toDayStart(to).getTime() - toDayStart(from).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function isDateOverdue(dueDate: Date, now: Date = new Date()) {
  return toDayStart(now) > toDayStart(dueDate);
}

/**
 * Marks a loan as OVERDUE if its due date has passed and it has an
 * outstanding balance. Returns true if it was transitioned.
 */
export async function markLoanOverdue(
  tx: Prisma.TransactionClient,
  loanId: string,
  now: Date = new Date(),
) {
  const loan = await tx.loan.findUnique({
    where: { id: loanId },
    include: { payments: true },
  });
  if (!loan) return false;
  if (loan.status !== LoanStatus.ACTIVE) return false;
  if (!isDateOverdue(loan.due, now)) return false;

  const paid = loan.payments.reduce(
    (sum, p) => sum.plus(p.amount),
    new Prisma.Decimal(0),
  );
  if (paid.gte(loan.amount)) return false;

  const updated = await tx.loan.updateMany({
    where: { id: loanId, status: LoanStatus.ACTIVE },
    data: { status: LoanStatus.OVERDUE },
  });
  if (updated.count !== 1) return false;

  await tx.loanStatusHistory.create({
    data: { loanId, status: LoanStatus.OVERDUE },
  });
  return true;
}

/**
 * Flags a machine request as OVERDUE if its expected end date has passed and
 * it is still IN_USE (not yet returned). Returns true if transitioned.
 */
export async function markMachineRequestOverdue(
  tx: Prisma.TransactionClient,
  requestId: string,
  now: Date = new Date(),
) {
  const request = await tx.machineRequest.findUnique({ where: { id: requestId } });
  if (!request) return false;
  if (request.status !== MachineStatus.IN_USE) return false;
  if (!request.endDate || !isDateOverdue(request.endDate, now)) return false;

  const updated = await tx.machineRequest.updateMany({
    where: { id: requestId, status: MachineStatus.IN_USE },
    data: { status: MachineStatus.OVERDUE },
  });
  return updated.count === 1;
}

export interface OverdueRecord {
  kind: "loan" | "machine";
  id: string;
  member:
    | { id: string; name: string | null; username: string; contact: string | null }
    | null;
  amount?: number;
  remaining?: number;
  dueDate: string | null;
  daysOverdue: number;
  entity: string;
}

/**
 * Scans the database for overdue loan and machine obligations and returns a
 * combined list. Optionally auto-marks active records as OVERDUE (recommended
 * for a "run detection" pass).
 */
export async function detectOverdueObligations(
  tx: Prisma.TransactionClient,
  opts: { autoMark?: boolean } = {},
) {
  const now = new Date();
  const overdue: OverdueRecord[] = [];

  const activeLoans = await tx.loan.findMany({
    where: { status: LoanStatus.ACTIVE },
    include: { payments: true, user: { select: { id: true, name: true, username: true } } },
  });

  for (const loan of activeLoans) {
    if (!isDateOverdue(loan.due, now)) continue;
    const paid = loan.payments.reduce(
      (sum, p) => sum.plus(p.amount),
      new Prisma.Decimal(0),
    );
    if (paid.gte(loan.amount)) continue;

    if (opts.autoMark) {
      await markLoanOverdue(tx, loan.id, now);
    }

    overdue.push({
      kind: "loan",
      id: loan.id,
      member: { ...loan.user, contact: null },
      amount: Number(loan.amount),
      remaining: Number(loan.amount.minus(paid)),
      dueDate: loan.due.toISOString(),
      daysOverdue: daysBetween(loan.due, now),
      entity: loan.name,
    });
  }

  const inUseMachines = await tx.machineRequest.findMany({
    where: { status: MachineStatus.IN_USE },
    include: { machine: true, user: { select: { id: true, name: true, username: true } } },
  });

  for (const request of inUseMachines) {
    if (!request.endDate || !isDateOverdue(request.endDate, now)) continue;
    if (opts.autoMark) {
      await markMachineRequestOverdue(tx, request.id, now);
    }

    overdue.push({
      kind: "machine",
      id: request.id,
      member: { ...request.user, contact: null },
      dueDate: request.endDate.toISOString(),
      daysOverdue: daysBetween(request.endDate, now),
      entity: request.machine.name,
    });
  }

  return overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

/**
 * Idempotently notifies the Secretary that there are overdue obligations that
 * may require communication (SMS) to members. Creates actionable notifications
 * whose count derives from the real overdue list.
 */
export async function notifyOfficersOfOverdue(
  tx: Prisma.TransactionClient,
  overdue: OverdueRecord[],
) {
  const relevant = overdue.filter((o) => o.kind === "loan");
  if (relevant.length === 0) return;

  const officers = await tx.user.findMany({
    where: { role: { in: ["SECRETARY", "TREASURER", "PRESIDENT"] }, active: true },
    select: { id: true },
  });

  await Promise.all(
    officers.map((officer) =>
      notifyUser(tx, {
        userId: officer.id,
        type: "LOAN_OVERDUE",
        link: "/dashboard/secretary?section=overdue",
        title: "Overdue loan communication needed",
        message: `${relevant.length} overdue loan(s) require follow-up communication with members.`,
      }),
    ),
  );
}

/**
 * Computes a machine's required duration in days using the
 * "1 hectare = 1 day" ceiling rule.
 */
export function requiredDurationDays(farmSize: number) {
  if (farmSize <= 0) return 1;
  return Math.ceil(farmSize);
}

export { BLOCKING_MACHINE_STATUSES };
