import {
  LoanStatus,
  MachineStatus,
  PaymentStatus,
  TransactionStatus,
} from "@/app/generated/prisma";
import { ApiError } from "@/lib/errors";

type TransitionMap<T extends string> = Record<T, readonly T[]>;

export const loanTransitions: TransitionMap<LoanStatus> = {
  PENDING: [LoanStatus.ACTIVE, LoanStatus.REJECTED],
  REJECTED: [],
  ACTIVE: [LoanStatus.PAID, LoanStatus.OVERDUE],
  OVERDUE: [LoanStatus.PAID, LoanStatus.ACTIVE],
  PAID: [],
};

export const paymentTransitions: TransitionMap<PaymentStatus> = {
  PENDING: [PaymentStatus.VERIFIED, PaymentStatus.REJECTED],
  VERIFIED: [],
  REJECTED: [],
};

export const applicationFeePaymentTransitions: TransitionMap<PaymentStatus> = {
  PENDING: [PaymentStatus.VERIFIED, PaymentStatus.REJECTED],
  VERIFIED: [],
  REJECTED: [],
};

export const supplyTransitions: TransitionMap<TransactionStatus> = {
  PENDING: [TransactionStatus.APPROVED, TransactionStatus.REJECTED],
  APPROVED: [TransactionStatus.COMPLETED, TransactionStatus.REJECTED],
  REJECTED: [],
  COMPLETED: [],
};

export const machineTransitions: TransitionMap<MachineStatus> = {
  QUEUED: [MachineStatus.APPROVED, MachineStatus.REJECTED],
  APPROVED: [MachineStatus.IN_USE, MachineStatus.REJECTED],
  IN_USE: [
    MachineStatus.RETURN_PENDING,
    MachineStatus.RETURNED,
    MachineStatus.OVERDUE,
  ],
  RETURN_PENDING: [MachineStatus.RETURNED, MachineStatus.IN_USE],
  RETURNED: [],
  // An overdue machine is still physically out with the member, so it must be
  // returnable. Allowing OVERDUE -> RETURN_PENDING lets a member in arrears
  // initiate a self-service return instead of being stuck until an officer
  // moves it. The machine is only free once RETURNED is reached.
  OVERDUE: [MachineStatus.RETURN_PENDING, MachineStatus.RETURNED],
  REJECTED: [],
};

/**
 * Machine request states with no outgoing transitions: the workflow is over and
 * the machine is no longer committed. Derived from `machineTransitions` so a
 * new terminal state cannot be forgotten.
 */
export const TERMINAL_MACHINE_STATUSES: MachineStatus[] = (
  Object.keys(machineTransitions) as MachineStatus[]
).filter((status) => (machineTransitions[status] ?? []).length === 0);

/**
 * Machine request states that still hold the machine. These are the states a
 * member's capacity pool and a machine's availability must treat as
 * "committed", so a machine is never promised twice.
 *
 * QUEUED is excluded even though it is not terminal: a queued request has not
 * been granted anything yet. It is awaiting an officer decision, and counting
 * it would let one member exhaust their capacity with requests the office has
 * not approved. Two overlapping queued requests are still safe, because the
 * overlap is re-checked at approval against the held set.
 *
 * The terminal set is derived from the transition map rather than restated, so
 * the guards below cannot drift from the lifecycle they enforce.
 */
export const MACHINE_HELD_STATUSES: MachineStatus[] = (
  Object.keys(machineTransitions) as MachineStatus[]
).filter(
  (status) =>
    !TERMINAL_MACHINE_STATUSES.includes(status) &&
    status !== MachineStatus.QUEUED,
);

/**
 * States in which a member may start a booking. Start is only meaningful once
 * the request has been approved, so this is deliberately narrower than the set
 * of returnable states below.
 */
export const MEMBER_STARTABLE_MACHINE_STATUSES: readonly MachineStatus[] = [
  MachineStatus.APPROVED,
];

/**
 * States from which a member may initiate a return. IN_USE is the normal case
 * and OVERDUE is included so a member in arrears can hand the machine back
 * instead of being stuck; RETURN_PENDING is excluded because the return has
 * already been initiated and is awaiting officer confirmation.
 */
export const MEMBER_RETURNABLE_MACHINE_STATUSES: readonly MachineStatus[] = [
  MachineStatus.IN_USE,
  MachineStatus.OVERDUE,
];

/**
 * Supply request states in which the request still consumes the member's
 * allowance and holds a claim on stock. Derived from `supplyTransitions`:
 * PENDING is still waiting on a decision, and APPROVED has stock reserved
 * against it until it is completed or rejected.
 */
export const OPEN_SUPPLY_STATUSES: TransactionStatus[] = (
  Object.keys(supplyTransitions) as TransactionStatus[]
).filter(
  (status) => (supplyTransitions[status] ?? []).length > 0,
);

export function assertTransition<T extends string>(
  transitions: TransitionMap<T>,
  current: T,
  next: T,
  subject: string,
) {
  if (!transitions[current]?.includes(next)) {
    throw new ApiError(
      409,
      `${subject} cannot move from ${current} to ${next}`,
    );
  }
}

/**
 * The term starts when the loan is approved, not when the member applied, so a
 * request that waits in the officer queue does not silently shorten the member's
 * term. `Loan.due` is NOT NULL and so carries a provisional estimate while the
 * request is PENDING; approval recomputes it from the approval timestamp.
 */
export function calculateLoanDueDateOnApproval(
  loan: { due: Date; termMonths: number; reviewedAt?: Date | null },
  approvedAt: Date = new Date(),
) {
  return calculateLoanDueDate(approvedAt, loan.termMonths);
}

export function calculateLoanDueDate(start: Date, termMonths: number) {
  const due = new Date(start);
  const originalDay = due.getDate();

  due.setDate(1);
  due.setMonth(due.getMonth() + termMonths + 1);
  due.setDate(0);
  due.setDate(Math.min(originalDay, due.getDate()));

  return due;
}
