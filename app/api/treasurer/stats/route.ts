import { NextResponse } from "next/server";
import prisma from "@/lib/client";
import { requireUser } from "@/lib/api";
import { FINANCE_ROLES } from "@/lib/permissions";

export async function GET() {
  try {
    await requireUser(FINANCE_ROLES);

    const [loans, payments] = await Promise.all([
      prisma.loan.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, username: true } },
          payments: { select: { amount: true } },
        },
      }),
      prisma.payment.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, username: true } },
          loan: { select: { id: true, name: true, type: true } },
        },
      }),
    ]);

    return NextResponse.json({
      loans: loans.map((l) => {
        const paid = l.payments.reduce(
          (sum, p) => sum + Number(p.amount),
          0,
        );
        return {
          id: l.id,
          borrower: { name: l.user.name || "Unknown", username: l.user.username },
          name: l.name,
          type: l.type,
          amount: Number(l.amount),
          remainingBalance: Math.max(Number(l.amount) - paid, 0),
          termMonths: l.termMonths,
          purpose: l.purpose,
          status: String(l.status),
          rejectionReason: l.rejectionReason,
          due: l.due?.toISOString() ?? null,
          createdAt: l.createdAt.toISOString(),
        };
      }),
      payments: payments.map((p) => ({
        id: p.id,
        user: { name: p.user.name || "Unknown", username: p.user.username },
        loan: p.loan ? { name: p.loan.name, type: p.loan.type } : null,
        amount: Number(p.amount),
        receiptUrl: p.receiptUrl,
        referenceNo: p.referenceNo,
        status: String(p.status),
        rejectionReason: p.rejectionReason,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Treasurer stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch treasurer data" },
      { status: 500 },
    );
  }
}
