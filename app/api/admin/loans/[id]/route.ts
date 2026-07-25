import { LoanStatus, Prisma } from "@/app/generated/prisma";
import { notifyUser, writeAudit } from "@/lib/activity";
import {
  apiErrorResponse,
  ApiError,
  readJsonBody,
  requireUser,
  requireUuid,
} from "@/lib/api";
import prisma from "@/lib/client";
import { assertTransition, loanTransitions } from "@/lib/lifecycles";
import { FINANCE_ROLES } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().min(1).max(500).optional(),
}).strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser(FINANCE_ROLES);
    const result = ReviewSchema.safeParse(await readJsonBody(req));
    if (!result.success) {
      throw new ApiError(400, result.error.issues[0].message);
    }
    if (result.data.action === "reject" && !result.data.reason) {
      throw new ApiError(400, "A rejection reason is required");
    }

    const { id: rawId } = await params;
    const id = requireUuid(rawId, "Loan ID");

    const updated = await prisma.$transaction(
      async (tx) => {
        const loan = await tx.loan.findUnique({ where: { id } });
        if (!loan) throw new ApiError(404, "Loan request not found");

        const nextStatus =
          result.data.action === "approve"
            ? LoanStatus.APPROVED
            : LoanStatus.REJECTED;
        assertTransition(loanTransitions, loan.status, nextStatus, "Loan");

        const claimed = await tx.loan.updateMany({
          where: { id, status: loan.status },
          data: {
            status: nextStatus,
            reviewedBy: actor.userId,
            reviewedAt: new Date(),
            rejectionReason:
              nextStatus === LoanStatus.REJECTED ? result.data.reason : null,
          },
        });
        if (claimed.count !== 1) {
          throw new ApiError(409, "Loan status changed during review");
        }
        await tx.loanStatusHistory.create({
          data: { loanId: id, status: nextStatus },
        });

        let finalStatus: LoanStatus = nextStatus;
        if (nextStatus === LoanStatus.APPROVED) {
          assertTransition(
            loanTransitions,
            LoanStatus.APPROVED,
            LoanStatus.ACTIVE,
            "Loan",
          );
          const activated = await tx.loan.updateMany({
            where: { id, status: LoanStatus.APPROVED },
            data: { status: LoanStatus.ACTIVE },
          });
          if (activated.count !== 1) {
            throw new ApiError(409, "Loan status changed during activation");
          }
          await tx.loanStatusHistory.create({
            data: { loanId: id, status: LoanStatus.ACTIVE },
          });
          finalStatus = LoanStatus.ACTIVE;
        }

        await notifyUser(tx, {
          userId: loan.userId,
          title:
            finalStatus === LoanStatus.ACTIVE
              ? "Loan approved"
              : "Loan request rejected",
          message:
            finalStatus === LoanStatus.ACTIVE
              ? `Your ₱${Number(loan.amount).toLocaleString()} loan is now active.`
              : `Your loan request was rejected. Reason: ${result.data.reason}`,
        });
        await writeAudit(tx, {
          userId: actor.userId,
          action:
            finalStatus === LoanStatus.ACTIVE
              ? "LOAN_APPROVED"
              : "LOAN_REJECTED",
          entity: "Loan",
          entityId: id,
          metadata: result.data.reason
            ? { reason: result.data.reason }
            : undefined,
        });

        return finalStatus;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json({
      message:
        result.data.action === "approve" ? "Loan approved" : "Loan rejected",
      status: updated,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to review loan request");
  }
}
