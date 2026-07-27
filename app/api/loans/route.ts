import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/client";
import {
  apiErrorResponse,
  ApiError,
  readJsonBody,
  requireUser,
} from "@/lib/api";
import { MEMBER_ROLES } from "@/lib/permissions";
import { notifyUser, writeAudit } from "@/lib/activity";
import { LoanStatus, Prisma, Role } from "@/app/generated/prisma";
import { calculateLoanDueDate } from "@/lib/lifecycles";
import { z } from "zod";

const LoanRequestSchema = z.object({
  amount: z.number().positive().max(5000).multipleOf(0.01),
  termMonths: z.number().int().min(6).max(24),
  purpose: z.string().trim().min(10).max(500),
  type: z.enum(["SUPPLY", "MONEY"]).default("MONEY"),
}).strict();

export async function GET() {
  try {
    const { userId } = await requireUser(MEMBER_ROLES);
    const loans = await prisma.loan.findMany({
      where: {
        userId,
      },
      include: {
        payments: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const allPayments = await prisma.loanPayment.findMany({
      where: {
        loan: {
          userId,
        },
      },
      include: {
        loan: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        paidAt: "desc",
      },
    });

    return NextResponse.json({
      loans: loans.map((l) => {
        const paidAmount = l.payments.reduce(
          (sum, p) => sum + Number(p.amount),
          0,
        );
        const remainingBalance = Number(l.amount) - paidAmount;

        return {
          id: l.id,
          name: l.name,
          type: l.type,
          status: l.status,
          amount: Number(l.amount),
          remainingBalance: remainingBalance > 0 ? remainingBalance : 0,
          due: l.due,
          termMonths: l.termMonths,
          purpose: l.purpose,
          rejectionReason: l.rejectionReason,
        };
      }),
      paymentHistory: allPayments.map((p) => ({
        receiptNo: p.receiptNo,
        paidAt: p.paidAt,
        amount: Number(p.amount),
        loanName: p.loan.name,
      })),
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch loans");
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser(MEMBER_ROLES);
    const result = LoanRequestSchema.safeParse(await readJsonBody(req));

    if (!result.success) {
      throw new ApiError(400, result.error.issues[0].message);
    }

    const due = calculateLoanDueDate(new Date(), result.data.termMonths);

    const loan = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.loan.findFirst({
          where: {
            userId: actor.userId,
            status: {
              in: [LoanStatus.PENDING, LoanStatus.APPROVED, LoanStatus.ACTIVE],
            },
          },
          select: { id: true },
        });

        if (existing) {
          throw new ApiError(
            409,
            "You already have a pending or active loan account",
          );
        }

        const created = await tx.loan.create({
          data: {
            userId: actor.userId,
            amount: result.data.amount,
            termMonths: result.data.termMonths,
            purpose: result.data.purpose,
            type: result.data.type,
            due,
          },
        });

        await tx.loanStatusHistory.create({
          data: { loanId: created.id, status: LoanStatus.PENDING },
        });
        await writeAudit(tx, {
          userId: actor.userId,
          action: "LOAN_REQUESTED",
          entity: "Loan",
          entityId: created.id,
          metadata: {
            amount: result.data.amount,
            termMonths: result.data.termMonths,
          },
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
              title: "New loan request",
              message: `A ₱${result.data.amount.toLocaleString()} ${result.data.type === "SUPPLY" ? "supply" : "cash"}-loan request is ready for review.`,
            }),
          ),
        );

        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json(
      { message: "Loan request submitted", loanId: loan.id },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to submit loan request");
  }
}
