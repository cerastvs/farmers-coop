import {
  EntrySource,
  EntryType,
  InitiatedBy,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  Prisma,
  Role,
  SupplyTransaction,
  SupplyTransactionType,
} from "@/app/generated/prisma";
import { ApiError } from "@/lib/errors";
import { manualCreateData } from "@/lib/services/entry-context";
import { generateReceiptNo } from "@/lib/services/loan-payments";
import { openSupplyLoan } from "@/lib/services/supply-loans";

type SupplyRequestToComplete = SupplyTransaction & {
  supply: { id: string; productName: string };
};

type Actor = { userId: string; userRole: Role };

/**
 * Finalizes an approved supply request once it is picked up: verifies that
 * inventory is sufficient, decrements stock, and — for loan-type requests —
 * opens the repayable supply-loan account. Purchase-type requests record the
 * collected payment as a verified cash transaction. Must run inside the same
 * transaction as the status transition to COMPLETED.
 */
export async function completeSupplyRequest(
  tx: Prisma.TransactionClient,
  request: SupplyRequestToComplete,
  actor: Actor,
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

  if (request.type === SupplyTransactionType.PURCHASE) {
    await tx.payment.create({
      data: {
        userId: request.userId,
        amount: request.totalPrice,
        type: PaymentType.SUPPLY_PURCHASE,
        paymentMethod: PaymentMethod.ON_SITE,
        status: PaymentStatus.VERIFIED,
        verifiedBy: actor.userId,
        verifiedAt: new Date(),
        paidAt: new Date(),
        receiptNo: generateReceiptNo(
          request.supplyId + request.userId + String(request.totalPrice),
        ),
        ...manualCreateData(actor.userId, actor.userRole, {
          entryType: EntryType.MANUAL,
          initiatedBy: InitiatedBy.SECRETARY,
          source: EntrySource.OFFICE,
        }),
        remarks: `Supply purchase: ${request.supply.productName} × ${request.quantity}`,
        supplyTransactionId: request.id,
      },
    });
  }

  if (request.type === SupplyTransactionType.LOAN) {
    await openSupplyLoan(tx, request);
  }
}