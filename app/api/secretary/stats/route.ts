import { NextResponse } from "next/server";
import prisma from "@/lib/client";
import { apiErrorResponse, requireUser } from "@/lib/api";
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
  MachineStatus.RETURN_PENDING,
  MachineStatus.OVERDUE,
  MachineStatus.REJECTED,
  MachineStatus.RETURNED,
];

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isCurrentlyInUse(request: {
  status: MachineStatus;
  startDate: Date | null;
  endDate: Date | null;
}): boolean {
  if (request.status !== MachineStatus.IN_USE) return false;
  if (!request.startDate || !request.endDate) return false;
  const today = toISODate(new Date());
  const start = toISODate(request.startDate);
  const end = toISODate(request.endDate);
  return today >= start && today <= end;
}

export async function GET() {
  try {
    await requireUser([Role.SECRETARY, Role.PRESIDENT]);
    const [
      applications,
      members,
      loans,
      machines,
      supplies,
      payments,
      reports,
      posts,
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
          user: { select: { id: true, name: true, username: true } },
          payments: { select: { amount: true } },
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
              rejectionReason: true,
              requestDate: true,
              startDate: true,
              endDate: true,
              startedAt: true,
              returnedAt: true,
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
        include: {
          transactions: {
            orderBy: { createdAt: "desc" },
            include: {
              user: { select: { id: true, name: true, username: true } },
            },
          },
        },
      }),

      prisma.payment.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, username: true } },
          loan: { select: { id: true, name: true } },
        },
      }),

      prisma.report.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      }),

      prisma.post.findMany({
        orderBy: [{ title: "asc" }, { id: "asc" }],
        include: {
          author: { select: { id: true, name: true, username: true } },
        },
      }),
    ]);

    const pendingApplicationsCount = applications.filter(
      (a) => a.status === ApplicationStatus.PENDING,
    ).length;
    const activeLoansCount = loans.filter(
      (l) => l.status === LoanStatus.ACTIVE,
    ).length;
    const totalBorrowedMachines = machines.filter((m) =>
      m.requests.some(isCurrentlyInUse),
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
        username: m.username,
        role: m.role,
        active: m.active,
        joined: m.createdAt.toISOString(),
        farm: m.applications[0]
          ? `${m.applications[0].farmSize} ha - ${m.applications[0].cropType}`
          : null,
      })),
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
      machines: machines.map((m) => {
        const currentUsers = m.requests.filter(isCurrentlyInUse);
        return {
          id: m.id,
          name: m.name,
          description: m.description,
          imageUrl: m.imageUrl,
          isBorrowed: currentUsers.length > 0,
          borrowedBy: currentUsers.map((r) => r.user.name || "Unknown"),
          currentUsage: currentUsers.map((r) => ({
            name: r.user.name || "Unknown",
            startDate: r.startDate?.toISOString() ?? null,
            endDate: r.endDate?.toISOString() ?? null,
          })),
          requests: m.requests.map((r) => ({
          id: r.id,
          status: r.status,
          rejectionReason: r.rejectionReason,
          requestDate: r.requestDate.toISOString(),
          startDate: r.startDate?.toISOString() ?? null,
          endDate: r.endDate?.toISOString() ?? null,
          returnedAt: r.returnedAt?.toISOString() ?? null,
          startedAt: r.startedAt?.toISOString() ?? null,
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
        };
      }),
      supplies: supplies.map((s) => ({
        id: s.id,
        name: s.productName,
        stock: s.quantity,
        price: Number(s.price),
        imageUrl: s.imageUrl,
        loanLimitPerHectare: s.loanLimitPerHectare,
        transactions: s.transactions.map((t) => ({
          id: t.id,
          quantity: t.quantity,
          totalPrice: Number(t.totalPrice),
          type: t.type,
          status: String(t.status),
          rejectionReason: t.rejectionReason,
          user: { name: t.user.name || "Unknown", username: t.user.username },
        })),
      })),
      payments: payments.map((p) => ({
        id: p.id,
        user: { name: p.user.name || "Unknown", username: p.user.username },
        loan: p.loan ? { name: p.loan.name } : null,
        amount: Number(p.amount),
        receiptUrl: p.receiptUrl,
        referenceNo: p.referenceNo,
        status: String(p.status),
        rejectionReason: p.rejectionReason,
        createdAt: p.createdAt.toISOString(),
      })),
      reports: reports.map((r) => ({
        id: r.id,
        title: r.title,
        type: String(r.type),
        createdAt: r.createdAt.toISOString(),
        data: r.data ? (JSON.parse(JSON.stringify(r.data)) as Record<string, unknown>) : null,
      })),
      posts: posts.map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
        published: p.published,
      })),
    });
  } catch (error) {
    console.error("Secretary stats error:", error);
    return apiErrorResponse(error, "Failed to fetch secretary data");
  }
}
