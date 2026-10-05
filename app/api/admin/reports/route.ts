import {
  ApplicationStatus,
  LoanStatus,
  LoanType,
  MachineStatus,
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
import { endOfBusinessDay } from "@/lib/business-time";
import { principalFromAmount } from "@/lib/services/loan-interest";
import {
  daysBetween,
  isMachineRequestOverdueAsOf,
} from "@/lib/services/overdue";
import { MACHINE_HELD_STATUSES } from "@/lib/lifecycles";
import {
  APPLICATION_STATUS_DOMAIN,
  validateStatuses,
} from "@/lib/report-filters";
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
  applicationStatuses: z.array(z.string()).optional(),
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

/**
 * Report types that honour a `memberId` filter. Mirrors `memberFilter` on each
 * entry in components/reports/catalog.ts — the two must stay in step.
 */
const MEMBER_FILTER_TYPES: readonly ReportType[] = [
  ReportType.MEMBERS,
  ReportType.LOANS,
  ReportType.PAYMENTS,
  ReportType.SUPPLIES,
  ReportType.MACHINES,
];

// Statuses shown in payment breakdowns.
const VISIBLE_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  PaymentStatus.PENDING,
  PaymentStatus.VERIFIED,
  PaymentStatus.REJECTED,
];

const isRejectedPayment = (payment: { status: PaymentStatus }) =>
  payment.status === PaymentStatus.REJECTED;

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sumPaymentAmounts(
  payments: readonly { status: PaymentStatus; amount: Prisma.Decimal }[],
  statuses: readonly PaymentStatus[],
) {
  return roundMoney(
    payments.reduce(
      (sum, payment) =>
        sum + (statuses.includes(payment.status) ? Number(payment.amount) : 0),
      0,
    ),
  );
}

// Machine requests whose booking has passed its scheduled end date and has not
// been returned. Kept in reports as of the selected date so a still-overdue
// request remains visible even when its original request date falls outside the
// period. Mirrors the dashboard's "Needs Attention" definition (APPROVED or
// IN_USE bookings past their end date), so e.g. an APPROVED booking that was
// never started and never returned still shows up as overdue.
function overdueMachineRequestsAsOfPrisma(filters: ReportFilters) {
  const asOf = reportDateBoundary(filters.to ?? filters.from, "start");
  return asOf
    ? {
        endDate: { lt: asOf },
        OR: [{ returnedAt: null }, { returnedAt: { gt: asOf } }],
      }
    : {};
}

// Status distribution for machine requests, with the OVERDUE bucket computed
// "as of" the selected date: a request is overdue only on days when its
// scheduled end date has passed and it had not yet been returned.
function machineRequestStatusCounts(
  requests: readonly {
    status: MachineStatus;
    endDate?: Date | null;
    returnedAt?: Date | null;
  }[],
  asOf: Date | null,
): Record<string, number> {
  const byStatus = countsBy(
    requests.map((request) => request.status),
    Object.values(MachineStatus),
  );
  const overdueStatuses = MACHINE_HELD_STATUSES as readonly MachineStatus[];
  byStatus[MachineStatus.OVERDUE] = asOf
    ? requests.filter(
        (request) =>
          overdueStatuses.includes(request.status) &&
          isMachineRequestOverdueAsOf(
            request.endDate,
            request.returnedAt,
            asOf,
          ),
      ).length
    : requests.filter((request) => request.status === MachineStatus.OVERDUE)
        .length;
  return byStatus;
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

const DISBURSED_LOAN_STATUSES: readonly LoanStatus[] = [
  LoanStatus.ACTIVE,
  LoanStatus.OVERDUE,
  LoanStatus.PAID,
];

function reportAsOf(filters: ReportFilters): Date {
  return (
    reportDateBoundary(filters.to ?? filters.from, "end") ?? currentDayEnd()
  );
}

function loanStatusAsOf(
  loan: { status: LoanStatus; createdAt: Date },
  history: readonly { status: LoanStatus; changedAt: Date }[],
  asOf: Date,
): LoanStatus {
  const entry = history
    .filter((item) => item.changedAt <= asOf)
    .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime())[0];
  return entry?.status ?? (loan.createdAt <= asOf ? LoanStatus.PENDING : loan.status);
}

function loanStatusesInPeriod(
  history: readonly { status: LoanStatus; changedAt: Date }[],
  filters: ReportFilters,
  asOf: Date,
) {
  return history.filter(
    (item) =>
      item.changedAt <= asOf && isInReportDateRange(item.changedAt, filters),
  );
}

function paymentStatusAsOf(
  payment: {
    status: PaymentStatus;
    createdAt: Date;
    verifiedAt?: Date | null;
    declinedAt?: Date | null;
  },
  asOf: Date,
): PaymentStatus {
  if (payment.status === PaymentStatus.VERIFIED) {
    return payment.verifiedAt && payment.verifiedAt > asOf
      ? PaymentStatus.PENDING
      : PaymentStatus.VERIFIED;
  }
  if (payment.status === PaymentStatus.REJECTED) {
    return payment.declinedAt && payment.declinedAt > asOf
      ? PaymentStatus.PENDING
      : PaymentStatus.REJECTED;
  }
  return PaymentStatus.PENDING;
}

function machineRequestStatusAsOf(
  request: {
    status: MachineStatus;
    startDate?: Date | null;
    startedAt?: Date | null;
    endDate?: Date | null;
    returnedAt?: Date | null;
  },
  asOf: Date,
): MachineStatus {
  if (request.returnedAt && request.returnedAt <= asOf) {
    return MachineStatus.RETURNED;
  }
  if (
    request.status === MachineStatus.QUEUED ||
    request.status === MachineStatus.REJECTED
  ) {
    return request.status;
  }
  const startsAt = request.startedAt ?? request.startDate;
  if (!startsAt || startsAt > asOf) return MachineStatus.APPROVED;
  if (isMachineRequestOverdueAsOf(request.endDate, request.returnedAt, asOf)) {
    return MachineStatus.OVERDUE;
  }
  if (request.status === MachineStatus.RETURN_PENDING) {
    return MachineStatus.RETURN_PENDING;
  }
  return MachineStatus.IN_USE;
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

// End of the current business day, used as the "as of" instant for reports
// generated without an explicit date range so still-overdue obligations match
// what officers see live on the dashboard. Resolved in the business timezone so
// a UTC deployment does not shift the cutoff by 8 hours.
function currentDayEnd() {
  return endOfBusinessDay(new Date());
}

function jsonData(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

type ReportFilters = {
  from?: string;
  to?: string;
  memberId?: string;
  statuses?: string[];
  applicationStatuses?: string[];
};

const whereFromFilters = (filters: ReportFilters): Prisma.UserWhereInput => ({
  ...(filters.memberId ? { id: filters.memberId } : {}),
});

async function generateMembersReport(filters: ReportFilters = {}) {
  // The two status domains on this report are unrelated enums and must never
  // share one filter: `role` is a Role, `status` is an ApplicationStatus.
  const roleFilter = validateStatuses(ReportType.MEMBERS, filters.statuses);
  const applicationFilter = validateStatuses(
    ReportType.MEMBERS,
    filters.applicationStatuses,
    APPLICATION_STATUS_DOMAIN,
  );

  const [users, applications] = await Promise.all([
    prisma.user.findMany({
      where: {
        ...whereFromFilters(filters),
        ...(roleFilter ? { role: { in: roleFilter as Role[] } } : {}),
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
        ...(applicationFilter
          ? { status: { in: applicationFilter as ApplicationStatus[] } }
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
  const statusFilter = validateStatuses(ReportType.LOANS, filters.statuses);
  const asOf = reportAsOf(filters);
  const loans = await prisma.loan.findMany({
    where: {
      AND: [
        ...(filters.memberId ? [{ userId: filters.memberId }] : []),
        { createdAt: { lte: asOf } },
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
        orderBy: { changedAt: "asc" },
      },
    },
  });

  const records = loans
    .map((loan) => {
      const status = loanStatusAsOf(loan, loan.statusHistory, asOf);
      const totalPaid = loan.payments
        .filter((payment) => payment.paidAt <= asOf)
        .reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
      const periodPayments = loan.payments.filter((payment) =>
        payment.paidAt <= asOf && isInReportDateRange(payment.paidAt, filters),
      );
      const periodHistory = loanStatusesInPeriod(
        loan.statusHistory,
        filters,
        asOf,
      );
      const approvedEntry = periodHistory.find(
        (entry) => entry.status === LoanStatus.ACTIVE,
      );
      const rejectedEntry = periodHistory.find(
        (entry) => entry.status === LoanStatus.REJECTED,
      );
      const decision = approvedEntry
        ? "Approved"
        : rejectedEntry
          ? "Rejected"
          : null;
      const decisionAt =
        approvedEntry?.changedAt.toISOString() ??
        rejectedEntry?.changedAt.toISOString() ??
        null;
      const rejectedPayments = loan.paymentSubmissions
        .filter(
          (payment) =>
            payment.createdAt <= asOf &&
            isInReportDateRange(payment.createdAt, filters),
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

      return {
        id: loan.id,
        borrower: loan.user,
        name: loan.name,
        principal: loanPrincipalAmount(loan),
        payable: Number(loan.amount),
        // Portfolio figures are cumulative through the report's as-of date.
        amountPaid: totalPaid,
        paidInPeriod: periodPayments.reduce(
          (sum, payment) => sum + Number(payment.amount),
          0,
        ),
        outstandingBalance: Math.max(Number(loan.amount) - totalPaid, 0),
        status,
        rejectionReason: loan.rejectionReason ?? null,
        decision,
        decisionAt,
        due: loan.due.toISOString(),
        createdAt: loan.createdAt.toISOString(),
        payments: periodPayments.map((payment) => ({
          ...payment,
          amount: Number(payment.amount),
          paidAt: payment.paidAt.toISOString(),
        })),
        rejectedPayments,
      };
    })
    .filter((loan) => !statusFilter || statusFilter.includes(loan.status));

  const portfolioLoans = records.filter((loan) =>
    DISBURSED_LOAN_STATUSES.includes(loan.status),
  );

  return {
    generatedAt: new Date().toISOString(),
    asOf: asOf.toISOString(),
    totals: {
      loans: records.length,
      // Principal is the cooperative's cumulative disbursement through the
      // report date, not only loans created inside the selected activity range.
      principal: roundMoney(
        portfolioLoans.reduce((sum, loan) => sum + loan.principal, 0),
      ),
      payable: roundMoney(
        portfolioLoans.reduce((sum, loan) => sum + loan.payable, 0),
      ),
      amountPaid: roundMoney(
        portfolioLoans.reduce((sum, loan) => sum + loan.amountPaid, 0),
      ),
      paidInPeriod: roundMoney(
        portfolioLoans.reduce((sum, loan) => sum + loan.paidInPeriod, 0),
      ),
      outstandingBalance: roundMoney(
        portfolioLoans.reduce((sum, loan) => sum + loan.outstandingBalance, 0),
      ),
      requestsApproved: records.filter((l) => l.decision === "Approved").length,
      requestsRejected: records.filter((l) => l.decision === "Rejected").length,
      rejectedPayments: records.reduce(
        (sum, loan) => sum + loan.rejectedPayments.length,
        0,
      ),
      rejectedAmount: roundMoney(
        records.reduce(
          (sum, loan) =>
            sum +
            loan.rejectedPayments.reduce(
              (s, payment) => s + payment.amount,
              0,
            ),
          0,
        ),
      ),
      byStatus: (() => {
        const byStatus = countsBy(
          records.map((loan) => loan.status),
          Object.values(LoanStatus),
        );
        return byStatus;
      })(),
    },
    loans: records,
  };
}

async function generatePaymentsReport(filters: ReportFilters = {}) {
  const statusFilter = validateStatuses(ReportType.PAYMENTS, filters.statuses);
  const hasRange = Boolean(filters.from || filters.to);
  const asOf = reportAsOf(filters);
  const payments = await prisma.payment.findMany({
    where: {
      ...(filters.memberId ? { userId: filters.memberId } : {}),
      createdAt: { lte: asOf },
      OR: hasRange
        ? [
            { createdAt: dateRangePrisma(filters) },
            { verifiedAt: dateRangePrisma(filters) },
            { declinedAt: dateRangePrisma(filters) },
            {
              status: PaymentStatus.PENDING,
              createdAt: { lte: asOf },
            },
          ]
        : [{ createdAt: { lte: asOf } }],
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
  const snapshotPayments = payments
    .map((payment) => ({
      ...payment,
      status: paymentStatusAsOf(payment, asOf),
    }))
    .filter((payment) => !statusFilter || statusFilter.includes(payment.status));
  return {
    generatedAt: new Date().toISOString(),
    asOf: asOf.toISOString(),
    totals: {
      payments: snapshotPayments.length,
      pendingAmount: sumPaymentAmounts(snapshotPayments, [PaymentStatus.PENDING]),
      verifiedAmount: sumPaymentAmounts(snapshotPayments, [PaymentStatus.VERIFIED]),
      rejectedAmount: sumPaymentAmounts(snapshotPayments, [PaymentStatus.REJECTED]),
      byStatus: countsBy(
        snapshotPayments.map((payment) => payment.status),
        VISIBLE_PAYMENT_STATUSES,
      ),
      byMethod: countsBy(
        snapshotPayments.map((payment) => payment.paymentMethod),
        ["ONLINE", "ON_SITE"] as const,
      ),
    },
    payments: snapshotPayments
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
    rejectedPayments: snapshotPayments
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
  const statusFilter = validateStatuses(ReportType.SUPPLIES, filters.statuses);
  const hasRange = Boolean(filters.from || filters.to);
  const asOf = reportAsOf(filters);
  const [supplies, repayments, rejectedPayments, reservedTxns, supplyAudits] =
    await Promise.all([
      prisma.supply.findMany({
        orderBy: { productName: "asc" },
        where: {
          createdAt: { lte: asOf },
        },
        include: {
          transactions: {
            orderBy: { createdAt: "desc" },
            where: {
              ...(filters.memberId ? { userId: filters.memberId } : {}),
              ...(statusFilter
                ? { status: { in: statusFilter as TransactionStatus[] } }
                : {}),
              OR: hasRange
                ? [
                    { createdAt: dateRangePrisma(filters) },
                    { reviewedAt: dateRangePrisma(filters) },
                    {
                      status: TransactionStatus.PENDING,
                      createdAt: { lte: asOf },
                    },
                  ]
                : [{ createdAt: { lte: asOf } }],
            },
            include: {
              user: { select: { id: true, name: true, username: true } },
            },
          },
        },
      }),
      prisma.loanPayment.findMany({
        where: {
          loan: filters.memberId
            ? { type: LoanType.SUPPLY, userId: filters.memberId }
            : { type: LoanType.SUPPLY },
          ...(filters.from || filters.to
            ? { paidAt: dateRangePrisma(filters) }
            : {}),
        },
        select: { amount: true },
      }),
      prisma.payment.findMany({
        where: {
          status: PaymentStatus.REJECTED,
          loan: filters.memberId
            ? { type: LoanType.SUPPLY, userId: filters.memberId }
            : { type: LoanType.SUPPLY },
          ...(filters.memberId ? { userId: filters.memberId } : {}),
          ...(hasRange
            ? { createdAt: dateRangePrisma(filters) }
            : { createdAt: { lte: asOf } }),
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
      prisma.supplyTransaction.findMany({
        // Include released reservations as well as current reservations so an
        // older inventory snapshot can reverse a rejection that happened later.
        where: {
          status: {
            in: [
              TransactionStatus.APPROVED,
              TransactionStatus.COMPLETED,
              TransactionStatus.REJECTED,
            ],
          },
        },
        select: {
          id: true,
          supplyId: true,
          quantity: true,
          status: true,
          reviewedAt: true,
          createdAt: true,
        },
      }),
      prisma.auditTrail.findMany({
        where: {
          entity: "SupplyTransaction",
          action: {
            in: ["SUPPLY_APPROVED", "SUPPLY_REJECTED", "SUPPLY_COMPLETED"],
          },
        },
        select: { entityId: true, action: true, createdAt: true },
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

  // Stock is deducted at approval and restored if an approved request is later
  // rejected. Reverse only those post-report stock events from today's stored
  // quantity. The audit trail preserves the approval timestamp even after a
  // request is completed, when `reviewedAt` has moved to pickup time.
  const stockAdjustmentAfterAsOf = new Map<string, number>();
  const auditsByTransaction = new Map<string, typeof supplyAudits>();
  for (const audit of supplyAudits) {
    if (!audit.entityId) continue;
    const entries = auditsByTransaction.get(audit.entityId);
    if (entries) entries.push(audit);
    else auditsByTransaction.set(audit.entityId, [audit]);
  }
  for (const t of reservedTxns) {
    const events = auditsByTransaction.get(t.id) ?? [];
    const approval = events.find((event) => event.action === "SUPPLY_APPROVED");
    const rejection = events.find((event) => event.action === "SUPPLY_REJECTED");
    const approvedAt = approval?.createdAt ??
      (t.status === TransactionStatus.APPROVED ? t.reviewedAt : null);
    const rejectedAt = rejection?.createdAt ??
      (t.status === TransactionStatus.REJECTED ? t.reviewedAt : null);
    let adjustment = 0;
    if (
      (t.status === TransactionStatus.APPROVED ||
        t.status === TransactionStatus.COMPLETED) &&
      approvedAt &&
      approvedAt > asOf
    ) {
      adjustment += t.quantity;
    }
    if (
      t.status === TransactionStatus.REJECTED &&
      approvedAt &&
      approvedAt <= asOf &&
      rejectedAt &&
      rejectedAt > asOf
    ) {
      adjustment -= t.quantity;
    }
    if (adjustment !== 0) {
      stockAdjustmentAfterAsOf.set(
        t.supplyId,
        (stockAdjustmentAfterAsOf.get(t.supplyId) ?? 0) + adjustment,
      );
    }
  }
  const stockAsOf = (supply: { id: string; quantity: number }): number =>
    supply.quantity + (stockAdjustmentAfterAsOf.get(supply.id) ?? 0);

  return {
    generatedAt: new Date().toISOString(),
    asOf: asOf.toISOString(),
    totals: {
      products: supplies.length,
      unitsInStock: supplies.reduce(
        (sum, supply) => sum + stockAsOf(supply),
        0,
      ),
      inventoryValue: roundMoney(
        supplies.reduce(
          (sum, supply) => sum + Number(supply.price) * stockAsOf(supply),
          0,
        ),
      ),
      requests: transactions.length,
      requestsByStatus: countsBy(
        transactions.map((transaction) => transaction.status),
        Object.values(TransactionStatus),
      ),
      sold: {
        units: sold.reduce((sum, t) => sum + t.quantity, 0),
        amount: roundMoney(
          sold.reduce((sum, t) => sum + Number(t.totalPrice), 0),
        ),
      },
      borrowed: {
        units: borrowed.reduce((sum, t) => sum + t.quantity, 0),
        amount: roundMoney(
          borrowed.reduce((sum, t) => sum + Number(t.totalPrice), 0),
        ),
      },
      paidBorrowed: {
        repayments: repayments.length,
        amount: roundMoney(
          repayments.reduce((sum, p) => sum + Number(p.amount), 0),
        ),
      },
      rejectedPayments: {
        count: rejectedPayments.length,
        amount: roundMoney(
          rejectedPayments.reduce((sum, p) => sum + Number(p.amount), 0),
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
        quantity: stockAsOf(supply),
        inventoryValue: roundMoney(Number(supply.price) * stockAsOf(supply)),
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
  const statusFilter = validateStatuses(ReportType.MACHINES, filters.statuses);
  const hasRange = Boolean(filters.from || filters.to);
  const machineAsOf = reportAsOf(filters);
  const machines = await prisma.machine.findMany({
    where: { createdAt: { lte: machineAsOf } },
    orderBy: { name: "asc" },
    include: {
      requests: {
        orderBy: { requestDate: "desc" },
        where: {
          ...(filters.memberId ? { userId: filters.memberId } : {}),
          ...(hasRange
            ? {
                OR: [
                  { requestDate: dateRangePrisma(filters) },
                  { startedAt: dateRangePrisma(filters) },
                  { returnedAt: dateRangePrisma(filters) },
                  overdueMachineRequestsAsOfPrisma(filters),
                ],
              }
            : { requestDate: { lte: machineAsOf } }),
        },
        include: {
          user: { select: { id: true, name: true, username: true } },
        },
      },
    },
  });
  const requests = machines.flatMap((machine) =>
    machine.requests
      .map((request) => ({
        ...request,
        status: machineRequestStatusAsOf(request, machineAsOf),
      }))
      .filter((request) => !statusFilter || statusFilter.includes(request.status)),
  );
  const includedRequestIds = new Set(requests.map((request) => request.id));
  // Returns where the officer flagged a condition. Surfaced as its own total
  // and section because "which machines came back damaged" is the question a
  // utilization report exists to answer, and it is invisible if the note is
  // only buried in a per-request table.
  const returnsWithIssues = requests.filter(
    (request) =>
      request.returnedAt &&
      request.returnedAt <= machineAsOf &&
      request.returnHasIssue,
  );
  const overdueRequests = requests
    .filter(
      (request) =>
        MACHINE_HELD_STATUSES.includes(request.status) &&
        isMachineRequestOverdueAsOf(
          request.endDate,
          request.returnedAt,
          machineAsOf,
        ),
    )
    .map((request) => {
      const machine = machines.find((m) =>
        m.requests.some((r) => r.id === request.id),
      );
      return {
        id: request.id,
        machine: machine?.name,
        member: request.user,
        status: request.status,
        endDate: request.endDate?.toISOString() ?? null,
        daysOverdue:
          request.endDate != null
            ? daysBetween(request.endDate, machineAsOf)
            : 0,
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    asOf: machineAsOf.toISOString(),
    totals: {
      machines: machines.length,
      requests: requests.length,
      requestsByStatus: machineRequestStatusCounts(requests, machineAsOf),
      overdue: overdueRequests.length,
      returnsWithIssues: returnsWithIssues.length,
    },
    overdueRequests,
    returnsWithIssues: returnsWithIssues.map((request) => {
      const machine = machines.find((m) =>
        m.requests.some((r) => r.id === request.id),
      );
      return {
        id: request.id,
        machine: machine?.name,
        member: request.user,
        condition: request.returnNote,
        returnedAt: request.returnedAt?.toISOString() ?? null,
      };
    }),
    machines: machines.map((machine) => ({
      id: machine.id,
      name: machine.name,
      description: machine.description,
      createdAt: machine.createdAt.toISOString(),
      requests: machine.requests
        .filter((request) => includedRequestIds.has(request.id))
        .map((request) => ({
          ...request,
          status: machineRequestStatusAsOf(request, machineAsOf),
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
  const [membersReport, loansReport, paymentsReport, suppliesReport, machinesReport, auditReport] =
    await Promise.all([
      generateMembersReport(filters),
      generateLoansReport(filters),
      generatePaymentsReport(filters),
      generateSuppliesReport(filters),
      generateMachinesReport(filters),
      generateAuditReport(filters),
    ]);

  const machineRequests = machinesReport.machines.flatMap((machine) =>
    machine.requests.map((request) => ({
      id: request.id,
      machine: { id: machine.id, name: machine.name },
      user: request.user,
      status: request.status,
    })),
  );

  return {
    generatedAt: new Date().toISOString(),
    asOf: reportAsOf(filters).toISOString(),
    members: {
      users: membersReport.totals.users,
      list: membersReport.members,
    },
    loans: {
      count: loansReport.totals.loans,
      principal: loansReport.totals.principal,
      payable: loansReport.totals.payable,
      amountPaid: loansReport.totals.amountPaid,
      paidInPeriod: loansReport.totals.paidInPeriod,
      outstandingBalance: loansReport.totals.outstandingBalance,
      rejectedRequests: loansReport.totals.requestsRejected,
      byStatus: loansReport.totals.byStatus,
      list: loansReport.loans.map((loan) => ({
        id: loan.id,
        user: loan.borrower,
        principal: loan.principal,
        payable: loan.payable,
        amountPaid: loan.amountPaid,
        paidInPeriod: loan.paidInPeriod,
        outstandingBalance: loan.outstandingBalance,
        status: loan.status,
        due: loan.due,
      })),
    },
    payments: {
      count: paymentsReport.totals.payments,
      pendingAmount: paymentsReport.totals.pendingAmount,
      verifiedAmount: paymentsReport.totals.verifiedAmount,
      rejectedAmount: paymentsReport.totals.rejectedAmount,
      byStatus: paymentsReport.totals.byStatus,
      byMethod: paymentsReport.totals.byMethod,
      list: paymentsReport.payments,
    },
    transactions: paymentsReport.payments,
    supplies: {
      ...suppliesReport.totals,
      list: suppliesReport.supplies.map((supply) => ({
        id: supply.id,
        productName: supply.productName,
        price: supply.price,
        quantity: supply.quantity,
        inventoryValue: supply.inventoryValue,
      })),
    },
    machines: {
      count: machinesReport.totals.machines,
      requests: machinesReport.totals.requests,
      requestsByStatus: machinesReport.totals.requestsByStatus,
      list: machinesReport.machines,
      requestsList: machineRequests,
    },
    audit: {
      entries: auditReport.totals.entries,
      list: auditReport.entries,
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

    // A member filter is only meaningful for the per-member reports. SUMMARY
    // and AUDIT are cooperative-wide, so a memberId there used to be accepted
    // and then silently ignored — an officer could believe a summary was scoped
    // to one member when it was not. Reject it instead of dropping it.
    if (result.data.memberId && !MEMBER_FILTER_TYPES.includes(result.data.type)) {
      throw new ApiError(
        400,
        "This report cannot be scoped to a single member",
      );
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
