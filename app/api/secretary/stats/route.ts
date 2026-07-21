import { NextResponse } from "next/server";
import prisma from "@/lib/client";
import { getSession } from "@/lib/session";
import {
  Role,
  ApplicationStatus,
  LoanStatus,
  MachineStatus,
} from "@/app/generated/prisma";

const ACTIVE_MACHINE_STATUSES = [
  MachineStatus.QUEUED,
  MachineStatus.APPROVED,
  MachineStatus.IN_USE,
];

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (session.userRole !== Role.SECRETARY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [
      pendingApplications,
      members,
      loans,
      machines,
      supplies,
    ] = await Promise.all([
      prisma.application.findMany({
        where: { status: ApplicationStatus.PENDING },
        orderBy: { createdAt: "desc" },
      }),

      prisma.user.findMany({
        where: { role: { in: [Role.MEMBER, Role.TREASURER, Role.PRESIDENT] } },
        orderBy: { createdAt: "desc" },
        include: {
          applications: {
            select: { farmSize: true, cropType: true },
            take: 1,
          },
        },
      }),

      prisma.loan.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true } },
        },
      }),

      prisma.machine.findMany({
        orderBy: { name: "asc" },
        include: {
          requests: {
            where: { status: { in: ACTIVE_MACHINE_STATUSES } },
            select: {
              id: true,
              status: true,
              user: { select: { name: true } },
            },
          },
        },
      }),

      prisma.supply.findMany({
        orderBy: { productName: "asc" },
      }),
    ]);

    const pendingApplicationsCount = pendingApplications.length;
    const activeLoansCount = loans.filter(
      (l) => l.status === LoanStatus.ACTIVE,
    ).length;
    const totalBorrowedMachines = machines.reduce(
      (sum, m) => sum + m.requests.length,
      0,
    );

    return NextResponse.json({
      summary: {
        pendingApplicationsCount,
        activeLoansCount,
        totalBorrowedMachines,
        totalMembers: members.length,
      },
      applications: pendingApplications.map((a) => ({
        id: a.id,
        name: a.fullName,
        date: a.createdAt,
        crop: a.cropType,
        status: a.status,
      })),
      members: members.map((m) => ({
        id: m.id,
        name: m.name || "Unknown",
        role: m.role,
        joined: m.createdAt,
        farm: m.applications[0]
          ? `${m.applications[0].farmSize} ha - ${m.applications[0].cropType}`
          : null,
      })),
      loans: loans.map((l) => ({
        id: l.id,
        borrower: l.user.name || "Unknown",
        name: l.name,
        amount: Number(l.amount),
        status: l.status,
        due: l.due,
      })),
      machines: machines.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        total: m.quantity,
        borrowed: m.requests.length,
        borrowedBy: m.requests.map((r) => r.user.name || "Unknown"),
      })),
      supplies: supplies.map((s) => ({
        id: s.id,
        name: s.productName,
        stock: s.quantity,
        price: Number(s.price),
      })),
    });
  } catch (error) {
    console.error("Secretary stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch secretary data" },
      { status: 500 },
    );
  }
}
