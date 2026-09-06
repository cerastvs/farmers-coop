import {
  Prisma,
  SupplyTransaction,
  SupplyTransactionType,
} from "@/app/generated/prisma";
import { ApiError } from "@/lib/errors";
import { openSupplyLoan } from "@/lib/services/supply-loans";

type SupplyRequestToComplete = SupplyTransaction & {
  supply: { id: string; productName: string };
};

/**
 * Finalizes an approved supply request once it is picked up: verifies that
 * inventory is sufficient, decrements stock, and — for loan-type requests —
 * opens the repayable supply-loan account. Must run inside the same
 * transaction as the status transition to COMPLETED.
 */
export async function completeSupplyRequest(
  tx: Prisma.TransactionClient,
  request: SupplyRequestToComplete,
) {
  const inventory = await tx.supply.updateMany({
    where: {
      id: request.supplyId,
      quantity: { gte: request.quantity },
    },
    data: { quantity: { decrement: request.quantity } },
  });
  if (inventory.count !== 1) {
    throw new ApiError(
      409,
      "Insufficient inventory to complete request",
    );
  }

  if (request.type === SupplyTransactionType.LOAN) {
    await openSupplyLoan(tx, request);
  }
}