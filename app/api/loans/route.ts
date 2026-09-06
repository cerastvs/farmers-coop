import { NextRequest, NextResponse } from "next/server";
import { LoanStatus } from "@/app/generated/prisma";
import prisma from "@/lib/client";
import {
  apiErrorResponse,
  ApiError,
  readJsonBody,
  requireUser,
} from "@/lib/api";
import { MEMBER_ROLES } from "@/lib/permissions";
import {
  LoanRequestSchema,
  submitLoanRequest,
} from "@/lib/services/member-actions";
import { ONLINE_CONTEXT } from "@/lib/services/entry-context";

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
        due: "asc",
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
      loans: loans
        .filter((l) => l.status !== LoanStatus.PAID)
        .map((l) => {
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

    const loan = await submitLoanRequest({
      actor,
      memberId: actor.userId,
      input: result.data,
      context: ONLINE_CONTEXT,
    });

    return NextResponse.json(
      { message: "Loan request submitted", loanId: loan.id },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to submit loan request");
  }
}
