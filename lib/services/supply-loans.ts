import {
  EntryType,
  InitiatedBy,
  LoanStatus,
  LoanType,
  Prisma,
  SupplyTransaction,
  SupplyTransactionType,
} from "@/app/generated/prisma";
import { writeAudit } from "@/lib/activity";
import { ApiError } from "@/lib/errors";
import { calculateLoanDueDate } from "@/lib/lifecycles";

export const SUPPLY_LOAN_DEFAULT_TERM_MONTHS = 6;

type PickedUpSupplyRequest = SupplyTransaction & {
  supply: { id: string; productName: string };
};

/**
 * Opens a repayable supply-loan account (a `Loan` of type SUPPLY) once a
 * loan-type supply request has been picked up. The obligation amount is the
 * value of the goods handed out, so it reuses the full loan repayment
 * machinery (ledger payments, receipts, verification, PAID closure).
 *
 * Must run inside the same transaction as the supply request completion.
 */
export async function openSupplyLoan(
  tx: Prisma.TransactionClient,
  request: PickedUpSupplyRequest,
) {
  if (request.type !== SupplyTransactionType.LOAN) {
    throw new ApiError(
      409,
      "Only loan-type supply requests open a supply loan account",
    );
  }
  if (
    !request.totalPrice ||
    request.totalPrice.lessThanOrEqualTo(new Prisma.Decimal(0))
  ) {
    throw new ApiError(409, "Supply loan total is zero");
  }

  const due = calculateLoanDueDate(
    new Date(),
    SUPPLY_LOAN_DEFAULT_TERM_MONTHS,
  );

  const created = await tx.loan.create({
    data: {
      userId: request.userId,
      name: `Farm Supply Loan — ${request.supply.productName}`,
      type: LoanType.SUPPLY,
      status: LoanStatus.ACTIVE,
      amount: request.totalPrice,
      termMonths: SUPPLY_LOAN_DEFAULT_TERM_MONTHS,
      purpose: `Farm inputs loaned — ${request.quantity} × ${request.supply.productName}`,
      due,
      reviewedBy: request.reviewedBy ?? request.createdById,
      reviewedAt: request.reviewedAt,
      createdById: request.createdById,
      createdByRole: request.createdByRole,
      entryType: request.entryType ?? EntryType.ONLINE,
      initiatedBy: request.initiatedBy ?? InitiatedBy.MEMBER,
      source: request.source,
      remarks: request.remarks,
    },
  });

  await tx.loanStatusHistory.create({
    data: { loanId: created.id, status: LoanStatus.ACTIVE },
  });

  const audit = await writeAudit(tx, {
    userId: request.reviewedBy ?? request.createdById ?? undefined,
    userRole: request.createdByRole ?? undefined,
    action: "SUPPLY_LOAN_OPENED",
    entity: "Loan",
    entityId: created.id,
    newStatus: LoanStatus.ACTIVE,
    metadata: {
      supplyTransactionId: request.id,
      supplyId: request.supplyId,
      quantity: request.quantity,
    },
  });
  await tx.loan.update({
    where: { id: created.id },
    data: { auditId: audit.id },
  });

  return created;
}