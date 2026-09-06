import {
  apiErrorResponse,
  ApiError,
  requireUser,
  requireUuid,
} from "@/lib/api";
import { notifyUser, writeAudit } from "@/lib/activity";
import { NotificationType, Role, TransactionStatus } from "@/app/generated/prisma";
import prisma from "@/lib/client";
import { assertTransition, supplyTransitions } from "@/lib/lifecycles";
import { MEMBER_ROLES } from "@/lib/permissions";
import { completeSupplyRequest } from "@/lib/services/supply-requests";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser(MEMBER_ROLES);
    const { id: rawId } = await params;
    const id = requireUuid(rawId, "Supply request ID");

    await prisma.$transaction(async (tx) => {
      const request = await tx.supplyTransaction.findUnique({
        where: { id },
        include: { supply: true },
      });
      if (!request) throw new ApiError(404, "Supply request not found");
      if (request.userId !== actor.userId) {
        throw new ApiError(403, "You can only pick up your own requests");
      }
      if (request.status !== TransactionStatus.APPROVED) {
        throw new ApiError(
          409,
          "Only approved requests can be marked as picked up",
        );
      }
      assertTransition(
        supplyTransitions,
        request.status,
        TransactionStatus.COMPLETED,
        "Supply request",
      );

      const claimed = await tx.supplyTransaction.updateMany({
        where: { id, status: request.status },
        data: {
          status: TransactionStatus.COMPLETED,
          reviewedBy: actor.userId,
          reviewedAt: new Date(),
        },
      });
      if (claimed.count !== 1) {
        throw new ApiError(409, "Supply request changed during pickup");
      }

      await completeSupplyRequest(tx, request);

      await notifyUser(tx, {
        userId: request.userId,
        type: NotificationType.SUPPLY_COMPLETED,
        link: "/dashboard/supplies",
        title: "Supply request picked up",
        message: `Your request for ${request.quantity} ${request.supply.productName} is now picked up.`,
      });
      await writeAudit(tx, {
        userId: actor.userId,
        userRole: actor.userRole,
        action: "SUPPLY_COMPLETED",
        entity: "SupplyTransaction",
        entityId: id,
        previousStatus: request.status,
        newStatus: TransactionStatus.COMPLETED,
      });
    });

    return NextResponse.json({ message: "Supply request marked as picked up" });
  } catch (error) {
    return apiErrorResponse(error, "Failed to pick up supply request");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser(MEMBER_ROLES);
    const { id } = await params;

    await prisma.$transaction(async (tx) => {
      const request = await tx.supplyTransaction.findUnique({
        where: { id },
        include: { supply: { select: { productName: true } } },
      });
      if (!request) throw new ApiError(404, "Request not found");
      if (request.userId !== actor.userId) {
        throw new ApiError(403, "Forbidden");
      }
      if (request.status !== TransactionStatus.PENDING) {
        throw new ApiError(409, "Only pending requests can be cancelled");
      }

      await tx.supplyTransaction.delete({ where: { id } });

      await notifyUser(tx, {
        userId: actor.userId,
        type: NotificationType.SUPPLY_REQUEST,
        link: "/dashboard/supplies",
        title: "Supply request cancelled",
        message: `Your request for ${request.quantity} ${request.supply.productName} was cancelled.`,
      });

      const member = await tx.user.findUnique({
        where: { id: actor.userId },
        select: { name: true },
      });
      const reviewers = await tx.user.findMany({
        where: {
          role: { in: [Role.SECRETARY, Role.TREASURER] },
          active: true,
        },
        select: { id: true },
      });
      await Promise.all(
        reviewers.map((reviewer) =>
          notifyUser(tx, {
            userId: reviewer.id,
            type: NotificationType.SUPPLY_REQUEST,
            link: "/dashboard/secretary?section=supplies",
            title: "Supply request withdrawn",
            message: `${member?.name ?? "A member"} withdrew a request for ${request.quantity} ${request.supply.productName}.`,
          }),
        ),
      );

      await writeAudit(tx, {
        userId: actor.userId,
        userRole: actor.userRole,
        action: "SUPPLY_REQUEST_CANCELLED",
        entity: "SupplyTransaction",
        entityId: id,
        newStatus: TransactionStatus.PENDING,
        metadata: {
          supplyId: request.supplyId,
          quantity: request.quantity,
          type: request.type,
        },
      });
    });

    return NextResponse.json({ message: "Request cancelled successfully" });
  } catch (error) {
    return apiErrorResponse(error, "Failed to cancel request");
  }
}