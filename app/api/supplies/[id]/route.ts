import {
  apiErrorResponse,
  ApiError,
  requireUser,
} from "@/lib/api";
import { notifyUser, writeAudit } from "@/lib/activity";
import { NotificationType, Role, TransactionStatus } from "@/app/generated/prisma";
import prisma from "@/lib/client";
import { MEMBER_ROLES } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

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