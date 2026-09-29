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

/**
 * Receipt number for a payment: `RCP-<year>-<ordinal>`. The ordinal is unique
 * across the whole year.
 *
 * Previously the number was derived from an 8-character slice of a caller-supplied
 * seed, which collided: seeds built from the same supply, member, and amount
 * produced the same receipt number on repeat dispatches within a year, and the
 * 8-char truncation also made unrelated seeds collide. A per-year sequence
 * cannot collide and stays readable for auditors.
 */
export function generateReceiptNo(seed: string, ordinal: number) {
  const year = new Date().getFullYear();
  const suffix = String(ordinal).padStart(6, "0");
  return `RCP-${year}-${suffix}`;
}

/**
 * Next receipt ordinal for the current year.
 *
 * Counts both `Payment` (application fees, supply purchases) and `LoanPayment`
 * (loan repayments) so the sequence is shared and no number is ever issued
 * twice across the two tables.
 *
 * Callers must run this inside the same transaction that writes the payment.
 * The payment paths use serializable isolation, which makes count-then-insert
 * safe against concurrent transactions taking the same ordinal.
 */
export async function nextReceiptOrdinal(
  tx: Prisma.TransactionClient,
): Promise<number> {
  const year = new Date().getFullYear();
  const prefix = `RCP-${year}-`;

  const [loanPayments, payments] = await Promise.all([
    tx.loanPayment.findMany({
      where: { receiptNo: { startsWith: prefix } },
      select: { receiptNo: true },
    }),
    tx.payment.findMany({
      where: { receiptNo: { startsWith: prefix } },
      select: { receiptNo: true },
    }),
  ]);

  let max = 0;
  for (const { receiptNo } of [...loanPayments, ...payments]) {
    if (!receiptNo) continue;
    const parsed = Number(receiptNo.slice(prefix.length));
    if (Number.isInteger(parsed) && parsed > max) max = parsed;
  }
  return max + 1;
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
  if (
    payment.loan.status !== LoanStatus.ACTIVE &&
    payment.loan.status !== LoanStatus.OVERDUE
  ) {
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
      receiptNo: generateReceiptNo(payment.id, await nextReceiptOrdinal(tx)),
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
