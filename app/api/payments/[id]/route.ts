import {
  apiErrorResponse,
  ApiError,
  requireUser,
  requireUuid,
} from "@/lib/api";
import { notifyUser, writeAudit } from "@/lib/activity";
import {
  NotificationType,
  PaymentStatus,
  PaymentType,
  Role,
} from "@/app/generated/prisma";
import prisma from "@/lib/client";
import { MEMBER_ROLES } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser(MEMBER_ROLES);
    const { id: rawId } = await params;
    const id = requireUuid(rawId, "Payment ID");

    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id },
        include: { loan: { select: { name: true } } },
      });
      if (!payment) throw new ApiError(404, "Payment not found");
      if (payment.userId !== actor.userId) {
        throw new ApiError(403, "Forbidden");
      }
      if (
        payment.status !== PaymentStatus.PENDING ||
        payment.type !== PaymentType.LOAN_PAYMENT
      ) {
        throw new ApiError(
          409,
          "Only pending loan payments can be cancelled",
        );
      }

      await tx.payment.delete({ where: { id } });

      await notifyUser(tx, {
        userId: actor.userId,
        type: NotificationType.PAYMENT_RECEIVED,
        link: "/dashboard/viewloan",
        title: "Payment submission cancelled",
        message: `Your ${payment.loan?.name ?? "loan"} payment of ₱${payment.amount.toNumber().toLocaleString()} was cancelled before verification.`,
      });

      const reviewers = await tx.user.findMany({
        where: {
          role: { in: [Role.TREASURER, Role.PRESIDENT] },
          active: true,
        },
        select: { id: true },
      });
      await Promise.all(
        reviewers.map((reviewer) =>
          notifyUser(tx, {
            userId: reviewer.id,
            type: NotificationType.PAYMENT_RECEIVED,
            link: "/dashboard/secretary?section=payments",
            title: "Payment submission withdrawn",
            message: `A ${payment.loan?.name ?? "loan"} payment submission was withdrawn before verification.`,
          }),
        ),
      );

      await writeAudit(tx, {
        userId: actor.userId,
        userRole: actor.userRole,
        action: "PAYMENT_CANCELLED",
        entity: "Payment",
        entityId: id,
        previousStatus: PaymentStatus.PENDING,
        metadata: {
          loanId: payment.loanId,
          amount: payment.amount.toNumber(),
        },
      });
    });

    return NextResponse.json({
      message: "Payment submission cancelled successfully",
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to cancel payment");
  }
}