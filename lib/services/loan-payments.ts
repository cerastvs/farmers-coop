import {
  LoanStatus,
  Payment,
  Prisma,
} from "@/app/generated/prisma";
import { ApiError } from "@/lib/errors";
import {
  assertTransition,
  loanTransitions,
} from "@/lib/lifecycles";

export type PaymentWithLoan = Payment & {
  loan: {
    id: string;
    userId: string;
    status: LoanStatus;
    amount: Prisma.Decimal;
    payments: { amount: Prisma.Decimal }[];
  } | null;
};

export function generateReceiptNo(seed: string) {
  return `RCP-${new Date().getFullYear()}-${seed.slice(0, 8).toUpperCase()}`;
}

/**
 * Applies a verified cash payment to its loan ledger. Validates that the
 * linked loan is active and owned by the payer, creates the loan-payment
 * entry with a receipt number, and closes the loan when fully settled.
 *
 * Shared by online payment verification (treasurer) and manual payments
 * recorded by the secretary so both paths follow identical accounting.
 */
export async function applyVerifiedLoanPayment(
  tx: Prisma.TransactionClient,
  payment: PaymentWithLoan,
) {
  if (!payment.loan) {
    throw new ApiError(409, "Payment is not linked to a loan");
  }
  if (payment.loan.userId !== payment.userId) {
    throw new ApiError(
      409,
      "Payment owner does not match the loan borrower",
    );
  }
  if (payment.loan.status !== LoanStatus.ACTIVE) {
    throw new ApiError(409, "The linked loan is not active");
  }

  const alreadyPaid = payment.loan.payments.reduce(
    (sum, entry) => sum.plus(entry.amount),
    new Prisma.Decimal(0),
  );
  const balance = payment.loan.amount.minus(alreadyPaid);
  if (payment.amount.greaterThan(balance)) {
    throw new ApiError(
      409,
      `Payment exceeds the remaining balance of ₱${balance.toNumber().toLocaleString()}`,
    );
  }

  await tx.loanPayment.create({
    data: {
      loanId: payment.loan.id,
      amount: payment.amount,
      receiptNo: generateReceiptNo(payment.id),
    },
  });

  if (payment.amount.equals(balance)) {
    assertTransition(
      loanTransitions,
      payment.loan.status,
      LoanStatus.PAID,
      "Loan",
    );
    const closed = await tx.loan.updateMany({
      where: {
        id: payment.loan.id,
        status: payment.loan.status,
      },
      data: { status: LoanStatus.PAID },
    });
    if (closed.count !== 1) {
      throw new ApiError(409, "Loan status changed during payment");
    }
    await tx.loanStatusHistory.create({
      data: { loanId: payment.loan.id, status: LoanStatus.PAID },
    });
  }
}
