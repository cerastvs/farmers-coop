import { NextRequest, NextResponse } from "next/server";

import { Role } from "@/app/generated/prisma";
import { apiErrorResponse, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { MEMBERSHIP_ROLES } from "@/lib/permissions";

const SEARCHABLE_ROLES = [Role.MEMBER, Role.PRESIDENT, Role.TREASURER];

function toISODate(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

export async function GET(req: NextRequest) {
  try {
    await requireUser(MEMBERSHIP_ROLES);

    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    const memberId = req.nextUrl.searchParams.get("id");

    if (!q && !memberId) {
      return NextResponse.json(
        { error: "Provide a search query or member id" },
        { status: 400 },
      );
    }

    const where = memberId
      ? { id: memberId }
      : {
          role: { in: SEARCHABLE_ROLES },
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { username: { contains: q, mode: "insensitive" as const } },
          ],
        };

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        applications: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            fullName: true,
            age: true,
            gender: true,
            address: true,
            contact: true,
            farmSize: true,
            cropType: true,
            yearsFarming: true,
          },
        },
        loans: {
          orderBy: { createdAt: "desc" },
          include: { payments: { select: { amount: true } } },
        },
        machineRequests: {
          orderBy: { requestDate: "desc" },
          take: 20,
          include: { machine: { select: { id: true, name: true } } },
        },
        supplyTransactions: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { supply: { select: { id: true, productName: true } } },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { loan: { select: { id: true, name: true } } },
        },
      },
    });

    return NextResponse.json({
      members: users.map((user) => {
        const app = user.applications[0] ?? null;
        const loans = user.loans.map((loan) => {
          const paid = loan.payments.reduce(
            (sum, p) => sum + Number(p.amount),
            0,
          );
          return {
            id: loan.id,
            name: loan.name,
            type: loan.type,
            amount: Number(loan.amount),
            remainingBalance: Math.max(Number(loan.amount) - paid, 0),
            status: loan.status,
            due: toISODate(loan.due),
            createdAt: toISODate(loan.createdAt),
          };
        });

        const activeLoan = loans.find((loan) => loan.status === "ACTIVE") ?? null;

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
          active: user.active,
          joined: toISODate(user.createdAt),
          application: app
            ? {
                fullName: app.fullName,
                age: app.age,
                gender: app.gender,
                address: app.address,
                contact: app.contact,
                farmSize: app.farmSize,
                cropType: app.cropType,
                yearsFarming: app.yearsFarming,
              }
            : null,
          loans,
          activeLoan,
          machineRequests: user.machineRequests.map((r) => ({
            id: r.id,
            machineName: r.machine.name,
            status: r.status,
            startDate: toISODate(r.startDate),
            endDate: toISODate(r.endDate),
          })),
          supplyTransactions: user.supplyTransactions.map((t) => ({
            id: t.id,
            productName: t.supply.productName,
            quantity: t.quantity,
            totalPrice: Number(t.totalPrice),
            type: t.type,
            status: t.status,
          })),
          payments: user.payments.map((p) => ({
            id: p.id,
            amount: Number(p.amount),
            type: p.type,
            status: p.status,
            loanName: p.loan?.name ?? null,
            createdAt: toISODate(p.createdAt),
          })),
        };
      }),
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to search members");
  }
}
