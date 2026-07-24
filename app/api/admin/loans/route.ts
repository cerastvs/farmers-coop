import { NextResponse } from "next/server";

import prisma from "@/lib/client";
import { apiErrorResponse, requireUser } from "@/lib/api";
import { FINANCE_ROLES } from "@/lib/permissions";

export async function GET() {
  try {
    await requireUser(FINANCE_ROLES);

    const loans = await prisma.loan.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, username: true } },
        payments: true,
        statusHistory: { orderBy: { changedAt: "asc" } },
      },
    });

    return NextResponse.json(
      loans.map((loan) => {
        const paid = loan.payments.reduce(
          (sum, payment) => sum + Number(payment.amount),
          0,
        );
        return {
          id: loan.id,
          borrower: loan.user,
          name: loan.name,
          amount: Number(loan.amount),
          remainingBalance: Math.max(Number(loan.amount) - paid, 0),
          termMonths: loan.termMonths,
          purpose: loan.purpose,
          due: loan.due,
          status: loan.status,
          rejectionReason: loan.rejectionReason,
          createdAt: loan.createdAt,
          history: loan.statusHistory,
        };
      }),
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch loan requests");
  }
}
