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
      applications,
      members,
      loans,
      machines,
      supplies,
    ] = await Promise.all([
      prisma.application.findMany({
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
              requestDate: true,
              startDate: true,
              endDate: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  applications: {
                    select: {
                      fullName: true,
                      contact: true,
                      address: true,
                      farmSize: true,
                      cropType: true,
                      yearsFarming: true,
                    },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      }),

      prisma.supply.findMany({
        orderBy: { productName: "asc" },
      }),
    ]);

    const pendingApplicationsCount = applications.filter(
      (a) => a.status === ApplicationStatus.PENDING,
    ).length;
    const activeLoansCount = loans.filter(
      (l) => l.status === LoanStatus.ACTIVE,
    ).length;
    const totalBorrowedMachines = machines.filter(
      (m) => m.requests.length > 0,
    ).length;

    return NextResponse.json({
      summary: {
        pendingApplicationsCount,
        activeLoansCount,
        totalBorrowedMachines,
        totalMembers: members.length,
      },
      applications: applications.map((a) => ({
        id: a.id,
        fullName: a.fullName,
        age: a.age,
        gender: a.gender,
        address: a.address,
        contact: a.contact,
        farmSize: a.farmSize,
        cropType: a.cropType,
        yearsFarming: a.yearsFarming,
        validIdUrl: a.validIdUrl,
        proofOfFarmUrl: a.proofOfFarmUrl,
        status: String(a.status),
        createdAt: a.createdAt.toISOString(),
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
        imageUrl: m.imageUrl,
        isBorrowed: m.requests.length > 0,
        borrowedBy: m.requests.map((r) => r.user.name || "Unknown"),
        requests: m.requests.map((r) => ({
          id: r.id,
          status: r.status,
          requestDate: r.requestDate.toISOString(),
          startDate: r.startDate?.toISOString() ?? null,
          endDate: r.endDate?.toISOString() ?? null,
          member: {
            id: r.user.id,
            name: r.user.name || "Unknown",
            email: r.user.username,
            contact: r.user.applications[0]?.contact ?? null,
            address: r.user.applications[0]?.address ?? null,
            farmSize: r.user.applications[0]?.farmSize ?? null,
            cropType: r.user.applications[0]?.cropType ?? null,
            yearsFarming: r.user.applications[0]?.yearsFarming ?? null,
          },
        })),
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
