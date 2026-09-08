import { LoanStatus, NotificationType, Prisma } from "@/app/generated/prisma";
import { notifyUser, writeAudit } from "@/lib/activity";
import {
  apiErrorResponse,
  ApiError,
  requireUser,
  requireUuid,
} from "@/lib/api";
import prisma from "@/lib/client";
import { FINANCE_ROLES, MEMBER_ROLES } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser(MEMBER_ROLES);
    const { id: rawId } = await params;
    const id = requireUuid(rawId, "Loan ID");

    await prisma.$transaction(
      async (tx) => {
        const loan = await tx.loan.findUnique({ where: { id } });
        if (!loan) throw new ApiError(404, "Loan request not found");
        if (loan.userId !== actor.userId) {
          throw new ApiError(403, "Forbidden");
        }
        if (loan.status !== LoanStatus.PENDING) {
          throw new ApiError(
            409,
            "Only pending loan requests can be cancelled",
          );
        }

        await tx.loan.delete({ where: { id } });

        await notifyUser(tx, {
          userId: actor.userId,
          type: NotificationType.GENERAL,
          link: "/dashboard/applyLoan",
          title: "Loan request cancelled",
          message: `Your loan request of ₱${Number(loan.amount).toLocaleString()} was cancelled.`,
        });

        const member = await tx.user.findUnique({
          where: { id: actor.userId },
          select: { name: true },
        });
        const reviewers = await tx.user.findMany({
          where: { role: { in: [...FINANCE_ROLES] }, active: true },
          select: { id: true },
        });
        await Promise.all(
          reviewers.map((reviewer) =>
            notifyUser(tx, {
              userId: reviewer.id,
              type: NotificationType.GENERAL,
              link: "/dashboard",
              title: "Loan request withdrawn",
              message: `${member?.name ?? "A member"} withdrew a loan request of ₱${Number(loan.amount).toLocaleString()}.`,
            }),
          ),
        );

        await writeAudit(tx, {
          userId: actor.userId,
          userRole: actor.userRole,
          action: "LOAN_REQUEST_CANCELLED",
          entity: "Loan",
          entityId: id,
          previousStatus: LoanStatus.PENDING,
          metadata: {
            amount: Number(loan.amount),
            type: loan.type,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json({ message: "Loan request cancelled" });
  } catch (error) {
    return apiErrorResponse(error, "Failed to cancel loan request");
  }
}