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
import {
  generateReceiptNo,
  nextReceiptOrdinal,
} from "@/lib/services/loan-payments";
import { openSupplyLoan } from "@/lib/services/supply-loans";

type SupplyRequestToComplete = SupplyTransaction & {
  supply: { id: string; productName: string };
};

type Actor = { userId: string; userRole: Role };

/**
 * Short gap enforced between a member's requests for the same item.
 *
 * Not a business cooldown. Members may hold any number of open requests, for
 * the same item or different ones; this only exists so that a double-clicked
 * submit button or a retried request cannot quietly become two identical
 * requests a second apart. It is deliberately short enough that nobody waits
 * on it in normal use.
 */
export const SUPPLY_REQUEST_INTERVAL_MS = 5_000;

/**
 * True when `lastRequestAt` is recent enough that another request for the same
 * item would be treated as an accidental repeat rather than a fresh one.
 *
 * `null` means the member has never requested this item, which is never too
 * soon. Exported so the rule can be tested without a database.
 */
export function tooSoonAfterRequest(
  lastRequestAt: Date | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!lastRequestAt) return false;
  const age = nowMs - lastRequestAt.getTime();
  return age < SUPPLY_REQUEST_INTERVAL_MS;
}

/**
 * Decrement on-hand stock, failing if the requested quantity is not available.
 * Uses a conditional UPDATE so two concurrent completions cannot both observe
 * the same stock level and drive it negative.
 */
async function decrementStock(
  tx: Prisma.TransactionClient,
  supplyId: string,
  quantity: number,
  message: string,
) {
  const inventory = await tx.supply.updateMany({
    where: { id: supplyId, quantity: { gte: quantity } },
    data: { quantity: { decrement: quantity } },
  });
  if (inventory.count !== 1) {
    throw new ApiError(409, message);
  }
}

/**
 * On approval, take the stock out of on-hand so the units are genuinely
 * committed to this member and cannot be promised to a second approved request.
 *
 * Previously stock was only decremented at pickup, so pending and approved
 * requests held no claim on inventory: two approved requests could exceed
 * available stock and the second would fail at the last step, after the member
 * had been told the goods were theirs. Reserving at approval rejects the
 * over-commitment while it is still cheap to resolve. The remaining stock
 * (already on hand, not yet dispatched) is what members see, so the displayed
 * figure now reflects what is genuinely available to promise.
 *
 * The atomic `gte` guard means a rejection racing an approval can never drive
 * stock negative — the second operation simply fails and its transaction rolls
 * back.
 */
export async function reserveSupplyRequestStock(
  tx: Prisma.TransactionClient,
  request: SupplyRequestToComplete,
) {
  await decrementStock(
    tx,
    request.supplyId,
    request.quantity,
    "Insufficient inventory to approve this request",
  );
}

/**
 * Return reserved stock to on-hand when an approved request is rejected before
 * pickup, or cancelled.
 */
export async function releaseSupplyRequestStock(
  tx: Prisma.TransactionClient,
  request: SupplyRequestToComplete,
) {
  await tx.supply.update({
    where: { id: request.supplyId },
    data: { quantity: { increment: request.quantity } },
  });
}

/**
 * Finalizes an approved supply request once it is picked up. Stock was already
 * deducted at approval, so this no longer decrements — it verifies the units are
 * still accounted for, and — for loan-type requests — opens the repayable
 * supply-loan account. Purchase-type requests record the collected payment as a
 * verified cash transaction. Must run inside the same transaction as the status
 * transition to COMPLETED.
 */
export async function completeSupplyRequest(
  tx: Prisma.TransactionClient,
  request: SupplyRequestToComplete,
  actor: Actor,
) {
  if (request.type === SupplyTransactionType.PURCHASE) {
    // `request.totalPrice` is the price frozen when the member submitted the
    // request, not the product's current price. The member agreed to that
    // figure, so the amount collected at pickup must be the one they were
    // quoted. Recomputing from `request.supply.price` here would let a price
    // edit between request and pickup silently change what the member owes.
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
          request.id,
          await nextReceiptOrdinal(tx),
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