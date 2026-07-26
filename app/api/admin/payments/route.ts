import { NextResponse } from "next/server";

import { apiErrorResponse, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { FINANCE_ROLES } from "@/lib/permissions";

export async function GET() {
  try {
    await requireUser(FINANCE_ROLES);
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, username: true } },
        loan: { select: { id: true, name: true, amount: true, status: true } },
      },
    });

    return NextResponse.json(
      payments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
        loan: payment.loan
          ? { ...payment.loan, amount: Number(payment.loan.amount) }
          : null,
      })),
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch payment submissions");
  }
}
