import {
  ApplicationStatus,
  LoanStatus,
  MachineStatus,
  PaymentStatus,
  PaymentType,
  Prisma,
  ReportType,
  Role,
  TransactionStatus,
} from "@/app/generated/prisma";
import { writeAudit } from "@/lib/activity";
import { apiErrorResponse, ApiError, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { RECORDS_ROLES } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const GenerateReportSchema = z.object({
  type: z.nativeEnum(ReportType),
  title: z.string().trim().min(3).max(150).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  memberId: z.string().optional(),
  statuses: z.array(z.string()).optional(),
  preview: z.boolean().optional(),
});

const DEFAULT_TITLES: Record<ReportType, string> = {
  SUMMARY: "Cooperative Summary Report",
  MEMBERS: "Member Records Report",
  LOANS: "Loan Portfolio Report",
  PAYMENTS: "Payment Activity Report",
  SUPPLIES: "Supply Inventory Report",
  MACHINES: "Machinery Utilization Report",
  AUDIT: "Audit Activity Report",
};

function countsBy<T extends string>(
  values: readonly T[],
  possibleValues: readonly T[],
) {
  return Object.fromEntries(
    possibleValues.map((value) => [
      value,
      values.filter((item) => item === value).length,
    ]),
  );
}

function jsonData(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

type ReportFilters = {
  from?: string;
  to?: string;
  memberId?: string;
  statuses?: string[];
};

function dateRangePrisma(filters: ReportFilters) {
  const range: Record<string, Date> = {};
  if (filters.from) {
    const from = new Date(filters.from);
    if (!isNaN(from.getTime())) range.gte = from;
  }
  if (filters.to) {
    const to = new Date(filters.to);
    if (!isNaN(to.getTime())) range.lte = to;
  }
  return range;
}

function isInDateRange(date: Date | null | undefined, filters: ReportFilters) {
  if (!date) return true;
  if (filters.from) {
    const from = new Date(filters.from);
    if (!isNaN(from.getTime()) && date < from) return false;
  }
  if (filters.to) {
    const to = new Date(filters.to);
    if (!isNaN(to.getTime()) && date > to) return false;
  }
  return true;
}

const whereFromFilters = (filters: ReportFilters): Prisma.UserWhereInput => ({
  ...(filters.memberId ? { id: filters.memberId } : {}),
});

async function generateMembersReport(filters: ReportFilters = {}) {
  const [users, applications] = await Promise.all([
    prisma.user.findMany({
      where: {
        ...whereFromFilters(filters),
        ...(filters.statuses && filters.statuses.length
          ? { role: { in: filters.statuses as Role[] } }
          : {}),
        ...(filters.from || filters.to
          ? { createdAt: dateRangePrisma(filters) }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        active: true,
        createdAt: true,
      },
    }),
    prisma.application.findMany({
      orderBy: { createdAt: "desc" },
      where: {
        ...(filters.memberId ? { userId: filters.memberId } : {}),
        ...(filters.statuses && filters.statuses.length
          ? { status: { in: filters.statuses as ApplicationStatus[] } }
          : {}),
        ...(filters.from || filters.to
          ? { createdAt: dateRangePrisma(filters) }
          : {}),
      },
      include: {
        reviewedByUser: {
          select: { id: true, name: true, username: true, role: true },
        },
        payments: {
          where: { type: PaymentType.APPLICATION_FEE },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            status: true,
            paymentMethod: true,
            verifiedAt: true,
            verifiedByUser: {
              select: { id: true, name: true, username: true, role: true },
            },
          },
        },
      },
    }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      users: users.length,
      active: users.filter((user) => user.active).length,
      inactive: users.filter((user) => !user.active).length,
      byRole: countsBy(
        users.map((user) => user.role),
        Object.values(Role),
      ),
      applicationsByStatus: countsBy(
        applications.map((application) => application.status),
        Object.values(ApplicationStatus),
      ),
    },
    members: users.map((user) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
    })),
    applications: applications.map((application) => ({
      id: application.id,
      applicant: application.fullName,
      appliedAt: application.createdAt.toISOString(),
      paymentStatus: application.payments[0]?.status ?? null,
      paymentMethod: application.payments[0]?.paymentMethod ?? null,
      paymentVerifiedAt:
        application.payments[0]?.verifiedAt?.toISOString() ?? null,
      paymentVerifiedBy: application.payments[0]?.verifiedByUser ?? null,
      applicationStatus: application.status,
      decision: application.reviewedAt
        ? application.status === ApplicationStatus.APPROVED
          ? "Approved"
          : application.status === ApplicationStatus.REJECTED
            ? "Denied"
            : null
        : null,
      decisionAt: application.reviewedAt?.toISOString() ?? null,
      decidedBy: application.reviewedByUser,
      denialReason: application.rejectionReason,
      denialDetails: application.rejectionDetails,
    })),
  };
}

async function generateLoansReport(filters: ReportFilters = {}) {
  const hasRange = Boolean(filters.from || filters.to);
  const loans = await prisma.loan.findMany({
    where: {
      ...(filters.memberId ? { userId: filters.memberId } : {}),
      ...(filters.statuses && filters.statuses.length
        ? { status: { in: filters.statuses as LoanStatus[] } }
        : {}),
      ...(hasRange
        ? {
            OR: [
              { createdAt: dateRangePrisma(filters) },
              { payments: { some: { paidAt: dateRangePrisma(filters) } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, username: true } },
      payments: { select: { amount: true, paidAt: true, receiptNo: true } },
    },
  });

  const records = loans.map((loan) => {
    const totalPaid = loan.payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    const inRangePayments = hasRange
      ? loan.payments.filter((payment) =>
          isInDateRange(payment.paidAt, filters),
        )
      : loan.payments;
    const paidInRange = inRangePayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    return {
      id: loan.id,
      borrower: loan.user,
      name: loan.name,
      amount: Number(loan.amount),
      amountPaid: paidInRange,
      outstandingBalance: Math.max(Number(loan.amount) - totalPaid, 0),
      status: loan.status,
      due: loan.due.toISOString(),
      createdAt: loan.createdAt.toISOString(),
      payments: inRangePayments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
        paidAt: payment.paidAt.toISOString(),
      })),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      loans: records.length,
      principal: records.reduce((sum, loan) => sum + loan.amount, 0),
      amountPaid: records.reduce((sum, loan) => sum + loan.amountPaid, 0),
      outstandingBalance: records.reduce(
        (sum, loan) => sum + loan.outstandingBalance,
        0,
      ),
      byStatus: countsBy(
        records.map((loan) => loan.status),
        Object.values(LoanStatus),
      ),
    },
    loans: records,
  };
}

async function generatePaymentsReport(filters: ReportFilters = {}) {
  const payments = await prisma.payment.findMany({
    where: {
      ...(filters.memberId ? { userId: filters.memberId } : {}),
      ...(filters.statuses && filters.statuses.length
        ? { status: { in: filters.statuses as PaymentStatus[] } }
        : {}),
      ...(filters.from || filters.to
        ? { createdAt: dateRangePrisma(filters) }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, username: true } },
      loan: { select: { id: true, name: true } },
      application: {
        select: {
          id: true,
          fullName: true,
          status: true,
          createdAt: true,
        },
      },
      proofUploadedBy: {
        select: { id: true, name: true, username: true, role: true },
      },
      verifiedByUser: {
        select: { id: true, name: true, username: true, role: true },
      },
      declinedByUser: {
        select: { id: true, name: true, username: true, role: true },
      },
    },
  });

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      payments: payments.length,
      submittedAmount: payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0,
      ),
      verifiedAmount: payments
        .filter(
          (payment) =>
            payment.status === PaymentStatus.VERIFIED ||
            payment.status === PaymentStatus.APPROVED,
        )
        .reduce((sum, payment) => sum + Number(payment.amount), 0),
      byStatus: countsBy(
        payments.map((payment) => payment.status),
        Object.values(PaymentStatus),
      ),
      byMethod: countsBy(
        payments.map((payment) => payment.paymentMethod),
        ["ONLINE", "ON_SITE"] as const,
      ),
    },
    payments: payments.map((payment) => ({
      id: payment.id,
      applicant: payment.application
        ? {
            id: payment.application.id,
            fullName: payment.application.fullName,
            applicationStatus: payment.application.status,
            appliedAt: payment.application.createdAt.toISOString(),
          }
        : null,
      user: payment.user,
      loan: payment.loan,
      type: payment.type,
      amount: Number(payment.amount),
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      receiptUrl: payment.receiptUrl,
      referenceNo: payment.referenceNo,
      createdAt: payment.createdAt.toISOString(),
      paidAt: payment.paidAt?.toISOString() ?? null,
      verifiedAt: payment.verifiedAt?.toISOString() ?? null,
      proofUploadedBy: payment.proofUploadedBy,
      proofUploadedAt: payment.proofUploadedAt?.toISOString() ?? null,
      verifiedBy: payment.verifiedByUser,
      declinedBy: payment.declinedByUser,
      declinedAt: payment.declinedAt?.toISOString() ?? null,
      rejectionReason: payment.rejectionReason,
    })),
  };
}

async function generateSuppliesReport(filters: ReportFilters = {}) {
  const supplies = await prisma.supply.findMany({
    orderBy: { productName: "asc" },
    include: {
      transactions: {
        orderBy: { createdAt: "desc" },
        where: {
          ...(filters.memberId ? { userId: filters.memberId } : {}),
          ...(filters.statuses && filters.statuses.length
            ? { status: { in: filters.statuses as TransactionStatus[] } }
            : {}),
          ...(filters.from || filters.to
            ? { createdAt: dateRangePrisma(filters) }
            : {}),
        },
        include: {
          user: { select: { id: true, name: true, username: true } },
        },
      },
    },
  });
  const transactions = supplies.flatMap((supply) => supply.transactions);

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      products: supplies.length,
      unitsInStock: supplies.reduce(
        (sum, supply) => sum + supply.quantity,
        0,
      ),
      inventoryValue: supplies.reduce(
        (sum, supply) => sum + Number(supply.price) * supply.quantity,
        0,
      ),
      requests: transactions.length,
      requestsByStatus: countsBy(
        transactions.map((transaction) => transaction.status),
        Object.values(TransactionStatus),
      ),
    },
    supplies: supplies.map((supply) => ({
      id: supply.id,
      productName: supply.productName,
      price: Number(supply.price),
      quantity: supply.quantity,
      inventoryValue: Number(supply.price) * supply.quantity,
      createdAt: supply.createdAt.toISOString(),
      transactions: supply.transactions.map((transaction) => ({
        ...transaction,
        totalPrice: Number(transaction.totalPrice),
        createdAt: transaction.createdAt.toISOString(),
        reviewedAt: transaction.reviewedAt?.toISOString() ?? null,
      })),
    })),
  };
}

async function generateMachinesReport(filters: ReportFilters = {}) {
  const machines = await prisma.machine.findMany({
    orderBy: { name: "asc" },
    include: {
      requests: {
        orderBy: { requestDate: "desc" },
        where: {
          ...(filters.memberId ? { userId: filters.memberId } : {}),
          ...(filters.statuses && filters.statuses.length
            ? { status: { in: filters.statuses as MachineStatus[] } }
            : {}),
          ...(filters.from || filters.to
            ? { requestDate: dateRangePrisma(filters) }
            : {}),
        },
        include: {
          user: { select: { id: true, name: true, username: true } },
        },
      },
    },
  });
  const requests = machines.flatMap((machine) => machine.requests);

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      machines: machines.length,
      requests: requests.length,
      requestsByStatus: countsBy(
        requests.map((request) => request.status),
        Object.values(MachineStatus),
      ),
    },
    machines: machines.map((machine) => ({
      id: machine.id,
      name: machine.name,
      description: machine.description,
      createdAt: machine.createdAt.toISOString(),
      requests: machine.requests.map((request) => ({
        ...request,
        requestDate: request.requestDate.toISOString(),
        startDate: request.startDate?.toISOString() ?? null,
        endDate: request.endDate?.toISOString() ?? null,
        returnedAt: request.returnedAt?.toISOString() ?? null,
      })),
    })),
  };
}

async function generateAuditReport() {
  const entries = await prisma.auditTrail.findMany({
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: {
      user: { select: { id: true, name: true, username: true, role: true } },
    },
  });
  const actionCounts = Object.fromEntries(
    [...new Set(entries.map((entry) => entry.action))].map((action) => [
      action,
      entries.filter((entry) => entry.action === action).length,
    ]),
  );

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      entries: entries.length,
      byAction: actionCounts,
      limitedToMostRecent: 1000,
    },
    entries: entries.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}

async function generateSummaryReport(filters: ReportFilters = {}) {
  const [users, loans, payments, supplies, supplyRequests, machines, requests, audits] =
    await Promise.all([
      prisma.user.count(),
      prisma.loan.findMany({
        select: { amount: true, status: true, payments: { select: { amount: true } } },
      }),
      prisma.payment.findMany({
        where:
          filters.from || filters.to
            ? { createdAt: dateRangePrisma(filters) }
            : {},
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, username: true } },
          application: { select: { id: true, fullName: true, status: true } },
        },
      }),
      prisma.supply.findMany({ select: { price: true, quantity: true } }),
      prisma.supplyTransaction.count(),
      prisma.machine.count(),
      prisma.machineRequest.findMany({ select: { status: true } }),
      prisma.auditTrail.count(),
    ]);
  const paid = loans.reduce(
    (total, loan) =>
      total +
      loan.payments.reduce(
        (loanTotal, payment) => loanTotal + Number(payment.amount),
        0,
      ),
    0,
  );

  return {
    generatedAt: new Date().toISOString(),
    members: { users },
    loans: {
      count: loans.length,
      principal: loans.reduce((sum, loan) => sum + Number(loan.amount), 0),
      amountPaid: paid,
      byStatus: countsBy(
        loans.map((loan) => loan.status),
        Object.values(LoanStatus),
      ),
    },
    payments: {
      count: payments.length,
      submittedAmount: payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0,
      ),
      byStatus: countsBy(
        payments.map((payment) => payment.status),
        Object.values(PaymentStatus),
      ),
    },
    transactions: payments.map((payment) => ({
      id: payment.id,
      applicant: payment.application
        ? {
            fullName: payment.application.fullName,
            applicationStatus: payment.application.status,
          }
        : null,
      user: payment.user,
      type: payment.type,
      amount: Number(payment.amount),
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      referenceNo: payment.referenceNo,
      createdAt: payment.createdAt.toISOString(),
    })),
    supplies: {
      products: supplies.length,
      requests: supplyRequests,
      unitsInStock: supplies.reduce(
        (sum, supply) => sum + supply.quantity,
        0,
      ),
      inventoryValue: supplies.reduce(
        (sum, supply) => sum + Number(supply.price) * supply.quantity,
        0,
      ),
    },
    machines: {
      count: machines,
      requests: requests.length,
      requestsByStatus: countsBy(
        requests.map((request) => request.status),
        Object.values(MachineStatus),
      ),
    },
    audit: { entries: audits },
  };
}

async function generateReportData(type: ReportType, filters: ReportFilters = {}) {
  switch (type) {
    case ReportType.MEMBERS:
      return generateMembersReport(filters);
    case ReportType.LOANS:
      return generateLoansReport(filters);
    case ReportType.PAYMENTS:
      return generatePaymentsReport(filters);
    case ReportType.SUPPLIES:
      return generateSuppliesReport(filters);
    case ReportType.MACHINES:
      return generateMachinesReport(filters);
    case ReportType.AUDIT:
      return generateAuditReport();
    case ReportType.SUMMARY:
      return generateSummaryReport(filters);
  }
}

export async function GET() {
  try {
    await requireUser(RECORDS_ROLES);
    const reports = await prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json(reports);
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch reports");
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser(RECORDS_ROLES);
    const result = GenerateReportSchema.safeParse(await req.json());
    if (!result.success) {
      throw new ApiError(400, result.error.issues[0].message);
    }

    const data = await generateReportData(result.data.type, result.data);

    if (result.data.preview) {
      return NextResponse.json({
        id: "preview",
        title: result.data.title ?? DEFAULT_TITLES[result.data.type],
        type: result.data.type,
        from: result.data.from ?? null,
        to: result.data.to ?? null,
        createdAt: new Date().toISOString(),
        data: JSON.parse(JSON.stringify(data)) as Record<string, unknown>,
      });
    }

    const report = await prisma.$transaction(async (tx) => {
      const created = await tx.report.create({
        data: {
          title: result.data.title ?? DEFAULT_TITLES[result.data.type],
          type: result.data.type,
          from: result.data.from ? new Date(result.data.from) : null,
          to: result.data.to ? new Date(result.data.to) : null,
          data: jsonData(data),
          generatedBy: actor.userId,
        },
      });
      await writeAudit(tx, {
        userId: actor.userId,
        userRole: actor.userRole,
        action: "REPORT_GENERATED",
        entity: "Report",
        entityId: created.id,
        metadata: {
          type: created.type,
          title: created.title,
          filters: {
            from: result.data.from ?? null,
            to: result.data.to ?? null,
            memberId: result.data.memberId ?? null,
            statuses: result.data.statuses ?? null,
          },
        },
      });
      return created;
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Failed to generate report");
  }
}
