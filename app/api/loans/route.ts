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
    // 1. Get all user loans
    const loans = await prisma.loan.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 2. Get all loan payments for this user
    const payments = await prisma.loanPayment.findMany({
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
        paidAt: 'desc',
      },
    });

    return NextResponse.json({
      loans: loans.map(l => ({
        id: l.id,
        name: l.name,
        status: l.status,
        amount: Number(l.amount),
        due: l.due,
      })),
      paymentHistory: payments.map(p => ({
        receiptNo: p.receiptNo,
        paidAt: p.paidAt,
        amount: Number(p.amount),
        loanName: p.loan.name, // Extra info for the table if needed
      })),
    });
  } catch (error) {
    console.error("Fetch loans error:", error);
    return NextResponse.json({ error: "Failed to fetch loans" }, { status: 500 });
  }
}
