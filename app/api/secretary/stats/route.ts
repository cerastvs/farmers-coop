import { NextResponse } from "next/server";
import prisma from "@/lib/client";
import { getSession } from "@/lib/session";
import {
  Role,
  ApplicationStatus,
  LoanStatus,
  PaymentStatus,
} from "@/app/generated/prisma/enums";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (session.userRole !== Role.SECRETARY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const pendingApplicationsCount = await prisma.application.count({
      where: {
        status: ApplicationStatus.PENDING,
      },
    });

    const pendingLoansCount = await prisma.loan.count({
      where: {
        status: LoanStatus.PENDING,
      },
    });

    const pendingPaymentsCount = await prisma.payment.count({
      where: {
        status: PaymentStatus.PENDING,
      },
    });

    const membersCount = await prisma.user.count({
      where: {
        role: Role.MEMBER,
      },
    });

    const pendingLoans = await prisma.loan.findMany({
      where: {
        status: LoanStatus.PENDING,
      },
      take: 3,
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const pendingPayments = await prisma.payment.count({
        where: {
            status: PaymentStatus.PENDING
        }
    })

    const pendingApplications = await prisma.application.findMany({
      where: {
        status: ApplicationStatus.PENDING,
      },
      take: 5,
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      pendingApplicationsCount,
      pendingLoansCount,
      pendingPaymentsCount,
      membersCount,
      pendingApplications,
      pendingTasks: [
        ...pendingLoans.map((loan) => ({
          title: `Review loan application - ${loan.user.name || "Unknown"}`,
          status: "Pending",
          due: "Today",
          type: "loan",
        })),
        {
          title: `Process ${pendingPaymentsCount} pending payments`,
          status: "Pending",
          due: "Today",
          type: "payment",
        },
      ],
    });
  } catch (error) {
    console.error("Secretary stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch secretary stats" },
      { status: 500 },
    );
  }
}
