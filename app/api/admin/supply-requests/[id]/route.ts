import {
  NotificationType,
  Prisma,
  Role,
  SupplyTransactionType,
  TransactionStatus,
} from "@/app/generated/prisma";
import { notifyUser, writeAudit } from "@/lib/activity";
import {
  apiErrorResponse,
  ApiError,
  readJsonBody,
  requireUser,
  requireUuid,
} from "@/lib/api";
import prisma from "@/lib/client";
import {
  assertTransition,
  OPEN_SUPPLY_STATUSES,
  supplyTransitions,
} from "@/lib/lifecycles";
import { SUPPLY_REVIEW_ROLES } from "@/lib/permissions";
import {
  completeSupplyRequest,
  releaseSupplyRequestStock,
  reserveSupplyRequestStock,
} from "@/lib/services/supply-requests";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ReviewSchema = z.object({
  action: z.enum(["approve", "reject", "complete"]),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((val) => (val ? val : undefined)),
}).strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser(SUPPLY_REVIEW_ROLES);
    const result = ReviewSchema.safeParse(await readJsonBody(req));
    if (!result.success) {
      throw new ApiError(400, result.error.issues[0].message);
    }
    if (result.data.action === "complete" && actor.userRole !== Role.PRESIDENT) {
      throw new ApiError(
        403,
        "Only the president can mark supply requests as picked up",
      );
    }

    const { id: rawId } = await params;
    const id = requireUuid(rawId, "Supply request ID");

    const finalStatus = await prisma.$transaction(
      async (tx) => {
        const request = await tx.supplyTransaction.findUnique({
          where: { id },
          include: { supply: true },
        });
        if (!request) throw new ApiError(404, "Supply request not found");

        const nextStatus = {
          approve: TransactionStatus.APPROVED,
          reject: TransactionStatus.REJECTED,
          complete: TransactionStatus.COMPLETED,
        }[result.data.action];
        assertTransition(
          supplyTransitions,
          request.status,
          nextStatus,
          "Supply request",
        );

        const claimed = await tx.supplyTransaction.updateMany({
          where: { id, status: request.status },
          data: {
            status: nextStatus,
            reviewedBy: actor.userId,
            reviewedAt: new Date(),
            rejectionReason:
              nextStatus === TransactionStatus.REJECTED
                ? result.data.reason ?? null
                : null,
          },
        });
        if (claimed.count !== 1) {
          throw new ApiError(409, "Supply request changed during review");
        }

        if (nextStatus === TransactionStatus.APPROVED) {
          // Re-validate the per-hectare loan limit at approval rather than
          // trusting the check made when the member requested. The limit is
          // derived from the member's farm size and the product's current
          // loanLimitPerHectare, and either can change while the request waits
          // in the officer queue — a staff farm-size correction or a lowered
          // per-hectare limit would otherwise let an approval exceed the cap
          // the member is actually entitled to.
          if (
            request.type === SupplyTransactionType.LOAN &&
            request.supply.loanLimitPerHectare != null
          ) {
            const application = await tx.application.findFirst({
              where: { userId: request.userId },
              select: { farmSize: true },
            });
            if (!application) {
              throw new ApiError(
                409,
                "No application on file — cannot verify farm size for this loan",
              );
            }
            const maxAllowed = Math.floor(
              application.farmSize * request.supply.loanLimitPerHectare,
            );
            // Count the member's other open loans, excluding this request, so
            // approving it does not count its own quantity twice.
            const otherLoaned =
              (
                await tx.supplyTransaction.aggregate({
                  where: {
                    userId: request.userId,
                    supplyId: request.supplyId,
                    type: SupplyTransactionType.LOAN,
                    status: { in: OPEN_SUPPLY_STATUSES },
                    id: { not: request.id },
                  },
                  _sum: { quantity: true },
                })
              )._sum.quantity ?? 0;

            if (otherLoaned + request.quantity > maxAllowed) {
              throw new ApiError(
                409,
                `This request exceeds the member's current loan limit for ${request.supply.productName} (limit: ${request.supply.loanLimitPerHectare} per ha × ${application.farmSize} ha = ${maxAllowed} total, ${otherLoaned} already on open loan, ${request.quantity} requested). Reject the request or have the member reduce the quantity.`,
              );
            }
          }

          // Commit the stock to this member now. Otherwise two approved
          // requests can exceed available inventory and the second only fails
          // at pickup, once the member has been told the goods are theirs.
          await reserveSupplyRequestStock(tx, request);
        }

        if (
          nextStatus === TransactionStatus.REJECTED &&
          request.status === TransactionStatus.APPROVED
        ) {
          // Rejected before pickup: give the reserved stock back.
          await releaseSupplyRequestStock(tx, request);
        }

        if (nextStatus === TransactionStatus.COMPLETED) {
          await completeSupplyRequest(tx, request, {
            userId: actor.userId,
            userRole: actor.userRole,
          });
        }

        await notifyUser(tx, {
          userId: request.userId,
          type:
            nextStatus === TransactionStatus.APPROVED
              ? NotificationType.SUPPLY_APPROVED
              : nextStatus === TransactionStatus.COMPLETED
                ? NotificationType.SUPPLY_COMPLETED
                : NotificationType.SUPPLY_REQUEST,
          link: "/dashboard",
          title: `Supply request ${nextStatus.toLowerCase()}`,
          message:
            nextStatus === TransactionStatus.REJECTED
              ? result.data.reason
                ? `Your request for ${request.supply.productName} was rejected. Reason: ${result.data.reason}`
                : `Your request for ${request.supply.productName} was rejected.`
              : `Your request for ${request.quantity} ${request.supply.productName} is now ${nextStatus.toLowerCase()}.`,
        });
        await writeAudit(tx, {
          userId: actor.userId,
          userRole: actor.userRole,
          action: `SUPPLY_${nextStatus}`,
          entity: "SupplyTransaction",
          entityId: id,
          previousStatus: request.status,
          newStatus: nextStatus,
          metadata: result.data.reason
            ? { reason: result.data.reason }
            : undefined,
        });

        return nextStatus;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json({
      message: `Supply request ${finalStatus.toLowerCase()}`,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to review supply request");
  }
}
