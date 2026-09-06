import { NextResponse } from "next/server";
import prisma from "@/lib/client";
import { getSession } from "@/lib/session";
import {
  LoanStatus,
  MachineStatus,
  TransactionStatus,
} from "@/app/generated/prisma";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = session.userId;

  try {
    const OPEN_STATUSES = [LoanStatus.ACTIVE, LoanStatus.OVERDUE];

    const activeLoansCount = await prisma.loan.count({
      where: {
        userId,
        status: { in: OPEN_STATUSES },
      },
    });

    const overdueLoansCount = await prisma.loan.count({
      where: {
        userId,
        status: LoanStatus.OVERDUE,
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
        status: { in: OPEN_STATUSES },
      },
      include: {
        payments: true,
      },
      orderBy: { due: "asc" },
    });

    let cashDebt = 0;
    let supplyDebt = 0;
    const totalDebt = activeLoans.reduce((acc, loan) => {
      const paidAmount = loan.payments.reduce(
        (pAcc, p) => pAcc + Number(p.amount),
        0,
      );
      const balance = Number(loan.amount) - paidAmount;
      if (loan.type === "SUPPLY") {
        supplyDebt += balance;
      } else {
        cashDebt += balance;
      }
      return acc + balance;
    }, 0);

    const nextLoan = activeLoans.find((l) => l.status !== LoanStatus.PAID) || null;

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
            type: true,
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
        type:
          t.type === "LOAN"
            ? `Supply loan: ${t.supply.productName}`
            : `Purchase: ${t.supply.productName}`,
        date: t.createdAt,
        amount: Number(t.totalPrice),
        debit: true,
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    return NextResponse.json({
      activeLoansCount,
      overdueLoansCount,
      borrowedMachinesCount,
      totalDebt,
      cashDebt,
      supplyDebt,
      nextPaymentDue: nextLoan?.due || null,
      activeLoans: activeLoans.map((l) => ({
        id: l.id,
        name: l.name,
        type: l.type,
        status: l.status,
        displayStatus:
          l.status === LoanStatus.OVERDUE
            ? "Overdue"
            : l.status === LoanStatus.ACTIVE
              ? "Active"
              : l.status,
        loanAmount: Number(l.amount),
        remainingBalance: Math.max(
          Number(l.amount) -
            l.payments.reduce((s, p) => s + Number(p.amount), 0),
          0,
        ),
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
