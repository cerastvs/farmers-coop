import { NextResponse } from "next/server";
import prisma from "@/lib/client";
import { getSession } from "@/lib/session";
import {
  LoanStatus,
  MachineStatus,
  PaymentStatus,
  TransactionStatus,
} from "@/app/generated/prisma/enums";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = session.userId;

  try {
    const activeLoansCount = await prisma.loan.count({
      where: {
        userId,
        status: LoanStatus.ACTIVE,
      },
    });

    const borrowedMachinesCount = await prisma.machineRequest.count({
      where: {
        userId,
        status: MachineStatus.IN_USE,
      },
    });

    const activeLoans = await prisma.loan.findMany({
      where: {
        userId,
        status: LoanStatus.ACTIVE,
      },
      include: {
        payments: true,
      },
    });

    const totalDebt = activeLoans.reduce((acc, loan) => {
      const paidAmount = loan.payments.reduce(
        (pAcc, p) => pAcc + Number(p.amount),
        0,
      );
      return acc + (Number(loan.amount) - paidAmount);
    }, 0);

    const nextLoan = await prisma.loan.findFirst({
      where: {
        userId,
        status: LoanStatus.ACTIVE,
      },
      orderBy: {
        due: "asc",
      },
    });

    const loanPayments = await prisma.loanPayment.findMany({
      where: {
        loan: {
          userId,
        },
      },
      take: 5,
      orderBy: {
        paidAt: "desc",
      },
      select: {
        amount: true,
        paidAt: true,
        loan: {
          select: {
            name: true,
          },
        },
      },
    });

    const supplyTransactions = await prisma.supplyTransaction.findMany({
      where: {
        userId,
        status: TransactionStatus.COMPLETED,
      },
      take: 5,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        supply: true,
      },
    });

    const allTransactions = [
      ...loanPayments.map((p) => ({
        type: `Payment: ${p.loan.name}`,
        date: p.paidAt,
        amount: Number(p.amount),
        debit: true,
      })),
      ...supplyTransactions.map((t) => ({
        type: `Purchase: ${t.supply.productName}`,
        date: t.createdAt,
        amount: Number(t.totalPrice),
        debit: true,
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    return NextResponse.json({
      activeLoansCount,
      borrowedMachinesCount,
      totalDebt,
      nextPaymentDue: nextLoan?.due || null,
      activeLoans: activeLoans.map((l) => ({
        name: l.name,
        status: "Active",
        loanAmount: Number(l.amount),
        nextPayment: l.due,
      })),
      recentTransactions: allTransactions,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 },
    );
  }
}
