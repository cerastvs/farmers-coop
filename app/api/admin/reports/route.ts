import {
  ApplicationStatus,
  LoanStatus,
  LoanType,
  MachineStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  Prisma,
  ReportType,
  Role,
  SupplyTransactionType,
  TransactionStatus,
} from "@/app/generated/prisma";
import { writeAudit } from "@/lib/activity";
import { apiErrorResponse, ApiError, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { RECORDS_ROLES } from "@/lib/permissions";
import { principalFromAmount } from "@/lib/services/loan-interest";
import {
  asOfPrisma,
  dateRangePrisma,
  isInReportDateRange,
  reportDateBoundary,
} from "@/lib/report-date-range";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

function formattedNameWithRole(name: string, role: Role): string {
  const label = role.toLowerCase().replace(/_/g, " ");
  return `${name} (${label.charAt(0).toUpperCase()}${label.slice(1)})`;
}

const GenerateReportSchema = z.object({
  type: z.nativeEnum(ReportType),
  title: z.string().trim().min(3).max(150).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  memberId: z.string().optional(),
  statuses: z.array(z.string()).optional(),
  preview: z.boolean().optional(),
  config: z
    .object({
      version: z.literal(1).optional(),
      preset: z.enum(["summary", "detailed", "full"]).optional(),
      sections: z.array(z.string()).optional(),
      columns: z.record(z.string(), z.array(z.string())).optional(),
      sort: z
        .object({ field: z.string(), dir: z.enum(["asc", "desc"]) })
        .nullable()
        .optional(),
      groupBy: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

const FINANCIAL_REPORT_TYPES: readonly ReportType[] = [
  ReportType.SUMMARY,
  ReportType.LOANS,
  ReportType.PAYMENTS,
  ReportType.SUPPLIES,
];

// Statuses shown in payment breakdowns.
const VISIBLE_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  PaymentStatus.PENDING,
  PaymentStatus.VERIFIED,
  PaymentStatus.REJECTED,
];

const isRejectedPayment = (payment: { status: PaymentStatus }) =>
  payment.status === PaymentStatus.REJECTED;

function sumPaymentAmounts(
  payments: readonly { status: PaymentStatus; amount: Prisma.Decimal }[],
  statuses: readonly PaymentStatus[],
) {
  return payments.reduce(
    (sum, payment) =>
      sum + (statuses.includes(payment.status) ? Number(payment.amount) : 0),
    0,
  );
}

// The initial loan amount before interest. For loans created before the
// principal field was recorded, reverse the stored payable using the rate.
function loanPrincipalAmount(loan: {
  amount: Prisma.Decimal;
  principalAmount: Prisma.Decimal | null;
  interestRate: Prisma.Decimal;
}): number {
  if (loan.principalAmount != null) return Number(loan.principalAmount);
  return principalFromAmount(loan.amount, Number(loan.interestRate));
}

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
          ? { createdAt: asOfPrisma(filters) }
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
          ? { createdAt: asOfPrisma(filters) }
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
      AND: [
        ...(filters.memberId ? [{ userId: filters.memberId }] : []),
        {
          ...(hasRange
            ? {
                OR: [
                  { createdAt: dateRangePrisma(filters) },
                  { payments: { some: { paidAt: dateRangePrisma(filters) } } },
                  { statusHistory: { some: { changedAt: dateRangePrisma(filters) } } },
                ],
              }
            : {}),
        },
        ...(filters.statuses && filters.statuses.length
          ? [{ status: { in: filters.statuses as LoanStatus[] } }]
          : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, username: true } },
      payments: { select: { amount: true, paidAt: true, receiptNo: true } },
      paymentSubmissions: {
        where: {
          status: { in: [PaymentStatus.REJECTED] },
        },
        select: {
          id: true,
          amount: true,
          status: true,
          rejectionReason: true,
          paymentMethod: true,
          referenceNo: true,
          createdAt: true,
        },
      },
      statusHistory: {
        select: { status: true, changedAt: true },
        orderBy: { changedAt: "desc" },
      },
    },
  });

  const records = loans.map((loan) => {
    const totalPaid = loan.payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    const inRangePayments = hasRange
      ? loan.payments.filter((payment) =>
          isInReportDateRange(payment.paidAt, filters),
        )
      : loan.payments;
    const paidInRange = inRangePayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    const rejectedPayments = loan.paymentSubmissions
      .filter(
        (payment) =>
          !hasRange || isInReportDateRange(payment.createdAt, filters),
      )
      .map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount),
        status: payment.status,
        rejectionReason: payment.rejectionReason,
        paymentMethod: payment.paymentMethod,
        referenceNo: payment.referenceNo,
        createdAt: payment.createdAt.toISOString(),
      }));

    const approvedEntry = loan.statusHistory.find(
      (h) => h.status === LoanStatus.ACTIVE,
    );
    const rejectedEntry = loan.statusHistory.find(
      (h) => h.status === LoanStatus.REJECTED,
    );
    const decision =
      approvedEntry
        ? "Approved"
        : rejectedEntry
          ? "Rejected"
          : null;
    const decisionAt =
      approvedEntry?.changedAt?.toISOString() ??
      rejectedEntry?.changedAt?.toISOString() ??
      null;

    return {
      id: loan.id,
      borrower: loan.user,
      name: loan.name,
      principal: loanPrincipalAmount(loan),
      payable: Number(loan.amount),
      amountPaid: paidInRange,
      outstandingBalance: Math.max(Number(loan.amount) - totalPaid, 0),
      status: loan.status,
      rejectionReason: loan.rejectionReason ?? null,
      decision,
      decisionAt,
      due: loan.due.toISOString(),
      createdAt: loan.createdAt.toISOString(),
      payments: inRangePayments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
        paidAt: payment.paidAt.toISOString(),
      })),
      rejectedPayments,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      loans: records.length,
      // Rejected loan requests are excluded from principal, payable, paid,
      // and outstanding amounts; they are surfaced as their own totals.
      principal: records
        .filter((loan) => loan.status !== LoanStatus.REJECTED)
        .reduce((sum, loan) => sum + loan.principal, 0),
      payable: records
        .filter((loan) => loan.status !== LoanStatus.REJECTED)
        .reduce((sum, loan) => sum + loan.payable, 0),
      amountPaid: records
        .filter((loan) => loan.status !== LoanStatus.REJECTED)
        .reduce((sum, loan) => sum + loan.amountPaid, 0),
      outstandingBalance: records
        .filter((loan) => loan.status !== LoanStatus.REJECTED)
        .reduce(
          (sum, loan) => sum + loan.outstandingBalance,
          0,
        ),
      requestsApproved: records.filter((l) => l.decision === "Approved").length,
      requestsRejected: records.filter((l) => l.decision === "Rejected").length,
      rejectedPayments: records.reduce(
        (sum, loan) => sum + loan.rejectedPayments.length,
        0,
      ),
      rejectedAmount: records.reduce(
        (sum, loan) =>
          sum +
          loan.rejectedPayments.reduce(
            (s, payment) => s + payment.amount,
            0,
          ),
        0,
      ),
      byStatus: (() => {
        const byStatus = countsBy(
          records.map((loan) => loan.status),
          Object.values(LoanStatus),
        );
        byStatus[LoanStatus.REJECTED] = records.reduce(
          (sum, loan) => sum + loan.rejectedPayments.length,
          0,
        );
        // REJECTED status bucket reflects rejected loan-payment submissions so
        // rejected activity is visible in the Loans by Status summary.
        return byStatus;
      })(),
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
loan: { select: { id: true, name: true, type: true } },

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
      pendingAmount: sumPaymentAmounts(payments, [PaymentStatus.PENDING]),
      verifiedAmount: sumPaymentAmounts(payments, [PaymentStatus.VERIFIED]),
      rejectedAmount: sumPaymentAmounts(payments, [PaymentStatus.REJECTED]),
      byStatus: countsBy(
        payments.map((payment) => payment.status),
        VISIBLE_PAYMENT_STATUSES,
      ),
      byMethod: countsBy(
        payments.map((payment) => payment.paymentMethod),
        ["ONLINE", "ON_SITE"] as const,
      ),
    },
    payments: payments
      .filter((payment) => !isRejectedPayment(payment))
      .map((payment) => ({
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
    rejectedPayments: payments
      .filter((payment) => isRejectedPayment(payment))
      .map((payment) => ({
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
        referenceNo: payment.referenceNo,
        createdAt: payment.createdAt.toISOString(),
        declinedBy: payment.declinedByUser,
        declinedAt: payment.declinedAt?.toISOString() ?? null,
        rejectionReason: payment.rejectionReason,
      })),
  };
}

async function generateSuppliesReport(filters: ReportFilters = {}) {
  const [supplies, repayments, rejectedPayments] = await Promise.all([
    prisma.supply.findMany({
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
    }),
    prisma.loanPayment.findMany({
      where: {
        loan: { type: LoanType.SUPPLY },
        ...(filters.from || filters.to
          ? { paidAt: dateRangePrisma(filters) }
          : {}),
      },
      select: { amount: true },
    }),
    prisma.payment.findMany({
      where: {
        status: PaymentStatus.REJECTED,
        loan: { type: LoanType.SUPPLY },
        ...(filters.memberId ? { userId: filters.memberId } : {}),
        ...(filters.from || filters.to
          ? { createdAt: dateRangePrisma(filters) }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, username: true } },
        loan: { select: { id: true, name: true } },
        declinedByUser: {
          select: { id: true, name: true, username: true, role: true },
        },
      },
    }),
  ]);
  const transactions = supplies.flatMap((supply) => supply.transactions);
  const completed = transactions.filter(
    (transaction) => transaction.status === TransactionStatus.COMPLETED,
  );
  const sold = completed.filter(
    (transaction) => transaction.type === SupplyTransactionType.PURCHASE,
  );
  const borrowed = completed.filter(
    (transaction) => transaction.type === SupplyTransactionType.LOAN,
  );

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
      sold: {
        units: sold.reduce((sum, t) => sum + t.quantity, 0),
        amount: sold.reduce((sum, t) => sum + Number(t.totalPrice), 0),
      },
      borrowed: {
        units: borrowed.reduce((sum, t) => sum + t.quantity, 0),
        amount: borrowed.reduce((sum, t) => sum + Number(t.totalPrice), 0),
      },
      paidBorrowed: {
        repayments: repayments.length,
        amount: repayments.reduce((sum, p) => sum + Number(p.amount), 0),
      },
      rejectedPayments: {
        count: rejectedPayments.length,
        amount: rejectedPayments.reduce(
          (sum, p) => sum + Number(p.amount),
          0,
        ),
      },
    },
    supplies: supplies.map((supply) => {
      const completedTxs = supply.transactions.filter(
        (t) => t.status === TransactionStatus.COMPLETED,
      );
      const soldUnits = completedTxs
        .filter((t) => t.type === SupplyTransactionType.PURCHASE)
        .reduce((sum, t) => sum + t.quantity, 0);
      const borrowedUnits = completedTxs
        .filter((t) => t.type === SupplyTransactionType.LOAN)
        .reduce((sum, t) => sum + t.quantity, 0);
      return {
        id: supply.id,
        productName: supply.productName,
        price: Number(supply.price),
        quantity: supply.quantity,
        inventoryValue: Number(supply.price) * supply.quantity,
        soldUnits,
        borrowedUnits,
        createdAt: supply.createdAt.toISOString(),
        transactions: supply.transactions.map((transaction) => ({
          ...transaction,
          totalPrice: Number(transaction.totalPrice),
          createdAt: transaction.createdAt.toISOString(),
          reviewedAt: transaction.reviewedAt?.toISOString() ?? null,
        })),
      };
    }),
    rejectedPayments: rejectedPayments.map((payment) => ({
      id: payment.id,
      member: payment.user,
      loan: payment.loan,
      amount: Number(payment.amount),
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      referenceNo: payment.referenceNo,
      createdAt: payment.createdAt.toISOString(),
      declinedAt: payment.declinedAt?.toISOString() ?? null,
      declinedBy: payment.declinedByUser,
      rejectionReason: payment.rejectionReason,
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

async function generateAuditReport(filters: ReportFilters = {}) {
  const entries = await prisma.auditTrail.findMany({
    where:
      filters.from || filters.to
        ? { createdAt: dateRangePrisma(filters) }
        : {},
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
  const hasRange = Boolean(filters.from || filters.to);
  const [users, loans, payments, supplies, machines, requests, audits, supplyRepayments] =
    await Promise.all([
      prisma.user.findMany({
        where:
          filters.from || filters.to
            ? { createdAt: asOfPrisma(filters) }
            : {},
        select: { id: true, name: true, username: true, role: true, active: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.loan.findMany({
        where: hasRange
          ? {
              OR: [
                { createdAt: dateRangePrisma(filters) },
                { payments: { some: { paidAt: dateRangePrisma(filters) } } },
                { statusHistory: { some: { changedAt: dateRangePrisma(filters) } } },
              ],
            }
          : {},
        select: {
          id: true,
          amount: true,
          principalAmount: true,
          interestRate: true,
          status: true,
          due: true,
          user: { select: { id: true, name: true, username: true } },
          payments: { select: { amount: true } },
        },
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
          loan: { select: { id: true, name: true, type: true } },
        },
      }),
      prisma.supply.findMany({
        select: {
          productName: true,
          price: true,
          quantity: true,
          transactions: {
            where: {
              ...(filters.statuses && filters.statuses.length
                ? { status: { in: filters.statuses as TransactionStatus[] } }
                : {}),
              ...(hasRange ? { createdAt: dateRangePrisma(filters) } : {}),
            },
            select: {
              quantity: true,
              type: true,
              status: true,
              totalPrice: true,
            },
          },
        },
      }),
      prisma.machine.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.machineRequest.findMany({
        where: hasRange ? { requestDate: dateRangePrisma(filters) } : {},
        include: {
          user: { select: { id: true, name: true } },
          machine: { select: { id: true, name: true } },
        },
      }),
      prisma.auditTrail.findMany({
        where: hasRange ? { createdAt: dateRangePrisma(filters) } : {},
        orderBy: { createdAt: "desc" },
        take: 200,
        include: {
          user: { select: { id: true, name: true, username: true, role: true } },
        },
      }),
      prisma.loanPayment.findMany({
        where: {
          loan: { type: LoanType.SUPPLY },
          ...(hasRange ? { paidAt: dateRangePrisma(filters) } : {}),
        },
        select: { amount: true },
      }),
    ]);
  const loanList = loans.map((loan) => {
    const amountPaid = loan.payments.reduce(
      (sum: number, p: { amount: Prisma.Decimal }) => sum + Number(p.amount),
      0,
    );
    const payable = Number(loan.amount);
    return {
      id: loan.id,
      user: loan.user,
      principal: loanPrincipalAmount(loan),
      payable,
      amount: payable,
      amountPaid,
      outstandingBalance: payable - amountPaid,
      status: loan.status,
      due: loan.due?.toISOString() ?? null,
    };
  });
  const supplyTransactions = supplies.flatMap((supply) => supply.transactions);
  const completed = supplyTransactions.filter(
    (t) => t.status === TransactionStatus.COMPLETED,
  );
  const sold = completed.filter(
    (t) => t.type === SupplyTransactionType.PURCHASE,
  );
  const borrowed = completed.filter(
    (t) => t.type === SupplyTransactionType.LOAN,
  );

  const activeLoanList = loanList.filter(
    (l) => l.status !== "REJECTED",
  );

  return {
    generatedAt: new Date().toISOString(),
    members: { users: users.length, list: users },
    loans: {
      count: loanList.length,
      // Rejected loan requests are excluded from principal, payable, paid,
      // and outstanding amounts; the rejected request count is reported separately.
      principal: activeLoanList.reduce((sum, l) => sum + l.principal, 0),
      payable: activeLoanList.reduce((sum, l) => sum + l.payable, 0),
      amountPaid: activeLoanList.reduce((sum, l) => sum + l.amountPaid, 0),
      outstandingBalance: activeLoanList.reduce(
        (sum, l) => sum + l.outstandingBalance,
        0,
      ),
      rejectedRequests: loanList.filter((l) => l.status === "REJECTED").length,
      byStatus: countsBy(
        loanList.map((l) => l.status),
        Object.values(LoanStatus),
      ),
      list: loanList,
    },
    payments: {
      count: payments.length,
      pendingAmount: sumPaymentAmounts(payments, [PaymentStatus.PENDING]),
      verifiedAmount: sumPaymentAmounts(payments, [PaymentStatus.VERIFIED]),
      rejectedAmount: sumPaymentAmounts(payments, [PaymentStatus.REJECTED]),
      byStatus: countsBy(
        payments.map((payment) => payment.status),
        VISIBLE_PAYMENT_STATUSES,
      ),
      byMethod: countsBy(
        payments.map((payment) => payment.paymentMethod),
        Object.values(PaymentMethod),
      ),
      list: payments
        .filter((payment) => !isRejectedPayment(payment))
        .map((payment) => ({
          id: payment.id,
          user: payment.user,
          applicant: payment.application
            ? { fullName: payment.application.fullName }
            : null,
          loan: payment.loan,
          type: payment.type,
          paymentMethod: payment.paymentMethod,
          amount: Number(payment.amount),
          status: payment.status,
          referenceNo: payment.referenceNo,
          createdAt: payment.createdAt.toISOString(),
        })),
    },
    transactions: payments
      .filter((payment) => !isRejectedPayment(payment))
      .map((payment) => ({
        id: payment.id,
        applicant: payment.application
          ? {
              fullName: payment.application.fullName,
              applicationStatus: payment.application.status,
            }
          : null,
        user: payment.user,
        loan: payment.loan,
        type: payment.type,
        amount: Number(payment.amount),
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        referenceNo: payment.referenceNo,
        createdAt: payment.createdAt.toISOString(),
      })),
    supplies: {
      products: supplies.length,
      requests: supplyTransactions.length,
      requestsByStatus: countsBy(
        supplyTransactions.map((t) => t.status),
        Object.values(TransactionStatus),
      ),
      unitsInStock: supplies.reduce(
        (sum, supply) => sum + supply.quantity,
        0,
      ),
      inventoryValue: supplies.reduce(
        (sum, supply) => sum + Number(supply.price) * supply.quantity,
        0,
      ),
      sold: {
        units: sold.reduce((sum, t) => sum + t.quantity, 0),
        amount: sold.reduce((sum, t) => sum + Number(t.totalPrice), 0),
      },
      borrowed: {
        units: borrowed.reduce((sum, t) => sum + t.quantity, 0),
        amount: borrowed.reduce((sum, t) => sum + Number(t.totalPrice), 0),
      },
      paidBorrowed: {
        repayments: supplyRepayments.length,
        amount: supplyRepayments.reduce((sum, p) => sum + Number(p.amount), 0),
      },
      list: supplies.map((s) => ({
        productName: s.productName,
        price: Number(s.price),
        quantity: s.quantity,
        inventoryValue: Number(s.price) * s.quantity,
      })),
    },
    machines: {
      count: machines.length,
      requests: requests.length,
      requestsByStatus: countsBy(
        requests.map((request) => request.status),
        Object.values(MachineStatus),
      ),
      list: machines,
      requestsList: requests.map((r) => ({
        id: r.id,
        machine: r.machine,
        user: r.user,
        status: r.status,
      })),
    },
    audit: {
      entries: audits.length,
      list: audits,
    },
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
      return generateAuditReport(filters);
    case ReportType.SUMMARY:
      return generateSummaryReport(filters);
  }
}

export async function GET() {
  try {
    const actor = await requireUser(RECORDS_ROLES);
    const reports = await prisma.report.findMany({
      where:
        actor.userRole === Role.TREASURER
          ? { type: { in: [...FINANCIAL_REPORT_TYPES] } }
          : {},
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const ids = [...new Set(reports.map((r) => r.generatedBy))];
    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, role: true },
    });
    const names = new Map(
      users.map((u) => [u.id, u.name ? formattedNameWithRole(u.name, u.role) : null]),
    );
    return NextResponse.json(
      reports.map((r) => ({
        ...r,
        generatedByName: names.get(r.generatedBy) ?? null,
      })),
    );
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

    if (
      actor.userRole === Role.TREASURER &&
      !FINANCIAL_REPORT_TYPES.includes(result.data.type)
    ) {
      throw new ApiError(403, "Financial reports only");
    }

    const actorMe = await prisma.user.findUnique({
      where: { id: actor.userId },
      select: { name: true },
    });
    const generatedByName = actorMe?.name
      ? formattedNameWithRole(actorMe.name, actor.userRole)
      : null;

    const data = await generateReportData(result.data.type, result.data);

    if (result.data.preview) {
      return NextResponse.json({
        id: "preview",
        title: result.data.title ?? DEFAULT_TITLES[result.data.type],
        type: result.data.type,
        from: result.data.from ?? null,
        to: result.data.to ?? null,
        createdAt: new Date().toISOString(),
        generatedBy: actor.userId,
        generatedByName,
        data: {
          ...(JSON.parse(JSON.stringify(data)) as Record<string, unknown>),
          __config: result.data.config ?? null,
        },
      });
    }

    const auditMetadata = {
      type: result.data.type,
      title: result.data.title ?? DEFAULT_TITLES[result.data.type],
      filters: {
        from: result.data.from ?? null,
        to: result.data.to ?? null,
        memberId: result.data.memberId ?? null,
        statuses: result.data.statuses ?? null,
      },
      config: result.data.config ?? null,
    };

    const report = await prisma.$transaction(async (tx) => {
      const created = await tx.report.create({
        data: {
          title: result.data.title ?? DEFAULT_TITLES[result.data.type],
          type: result.data.type,
          from: reportDateBoundary(result.data.from, "start"),
          to: reportDateBoundary(result.data.to, "end"),
          data: jsonData({
            ...data,
            __config: result.data.config ?? null,
          }),
          generatedBy: actor.userId,
        },
      });
      await writeAudit(tx, {
        userId: actor.userId,
        userRole: actor.userRole,
        action: "REPORT_GENERATED",
        entity: "Report",
        entityId: created.id,
        metadata: auditMetadata,
      });
      return created;
    });

    return NextResponse.json(
      {
        ...report,
        generatedByName,
      },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to generate report");
  }
}
