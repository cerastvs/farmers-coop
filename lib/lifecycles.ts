import {
  LoanStatus,
  MachineStatus,
  PaymentStatus,
  TransactionStatus,
} from "@/app/generated/prisma";
import { ApiError } from "@/lib/errors";

type TransitionMap<T extends string> = Record<T, readonly T[]>;

export const loanTransitions: TransitionMap<LoanStatus> = {
  PENDING: [LoanStatus.APPROVED, LoanStatus.REJECTED],
  APPROVED: [LoanStatus.ACTIVE, LoanStatus.REJECTED],
  REJECTED: [],
  ACTIVE: [LoanStatus.PAID, LoanStatus.OVERDUE],
  OVERDUE: [LoanStatus.PAID, LoanStatus.ACTIVE],
  PAID: [],
};

export const paymentTransitions: TransitionMap<PaymentStatus> = {
  PENDING: [PaymentStatus.VERIFIED, PaymentStatus.REJECTED],
  VERIFIED: [],
  REJECTED: [],
  // Application-fee workflow. Resubmissions create a fresh payment row, so a
  // declined proof never needs to move back to PENDING_APPROVAL in place.
  PENDING_APPROVAL: [PaymentStatus.APPROVED, PaymentStatus.DECLINED],
  APPROVED: [],
  DECLINED: [],
};

export const applicationFeePaymentTransitions: TransitionMap<PaymentStatus> = {
  PENDING: [],
  VERIFIED: [],
  REJECTED: [],
  PENDING_APPROVAL: [PaymentStatus.APPROVED, PaymentStatus.DECLINED],
  APPROVED: [],
  DECLINED: [],
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
  IN_USE: [MachineStatus.RETURN_PENDING, MachineStatus.RETURNED, MachineStatus.OVERDUE],
  RETURN_PENDING: [MachineStatus.RETURNED, MachineStatus.IN_USE],
  RETURNED: [],
  OVERDUE: [MachineStatus.RETURNED],
  REJECTED: [],
};

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

export function calculateLoanDueDate(start: Date, termMonths: number) {
  const due = new Date(start);
  const originalDay = due.getDate();

  due.setDate(1);
  due.setMonth(due.getMonth() + termMonths + 1);
  due.setDate(0);
  due.setDate(Math.min(originalDay, due.getDate()));

  return due;
}
