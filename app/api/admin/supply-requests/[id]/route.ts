import { NotificationType, Prisma, TransactionStatus } from "@/app/generated/prisma";
import { notifyUser, writeAudit } from "@/lib/activity";
import {
  apiErrorResponse,
  ApiError,
  readJsonBody,
  requireUser,
  requireUuid,
} from "@/lib/api";
import prisma from "@/lib/client";
import { assertTransition, supplyTransitions } from "@/lib/lifecycles";
import { SUPPLY_REVIEW_ROLES } from "@/lib/permissions";
import { completeSupplyRequest } from "@/lib/services/supply-requests";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ReviewSchema = z.object({
  action: z.enum(["approve", "reject", "complete"]),
  reason: z.string().trim().min(1).max(500).optional(),
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
    if (result.data.action === "reject" && !result.data.reason) {
      throw new ApiError(400, "A rejection reason is required");
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
                ? result.data.reason
                : null,
          },
        });
        if (claimed.count !== 1) {
          throw new ApiError(409, "Supply request changed during review");
        }

        if (nextStatus === TransactionStatus.COMPLETED) {
          await completeSupplyRequest(tx, request);
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
              ? `Your request for ${request.supply.productName} was rejected. Reason: ${result.data.reason}`
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
