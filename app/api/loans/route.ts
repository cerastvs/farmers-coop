import { NextResponse } from "next/server";
import prisma from "@/lib/client";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = session.userId;

  try {
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
          status: l.status,
          amount: Number(l.amount),
          remainingBalance: remainingBalance > 0 ? remainingBalance : 0,
          due: l.due,
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
    console.error("Fetch loans error:", error);
    return NextResponse.json(
      { error: "Failed to fetch loans" },
      { status: 500 },
    );
  }
}
