import prisma from "@/lib/client";
import { getApplicationFeeAmount } from "@/lib/application-fee";
import {
  LoanStatus,
  MachineStatus,
  PaymentType,
  TransactionStatus,
} from "@/app/generated/prisma";

export interface DashboardUser {
  id: string;
  name: string | null;
  username: string;
  role: string;
  hasApplied: boolean;
  applicationStatus: string | null;
}

export interface DashboardStats {
  activeLoansCount: number;
  overdueLoansCount: number;
  borrowedMachinesCount: number;
  totalDebt: number;
  cashDebt: number;
  supplyDebt: number;
  hasGuarantor: boolean;
  rejectedLoanIds: string[];
  supplyRequestIds: string[];
  machineRequestIds: string[];
  loanDueAlerts: number;
  nextPaymentDue: string | null;
  activeLoans: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    displayStatus: string;
    loanAmount: number;
    remainingBalance: number;
    nextPayment: string;
  }>;
  recentTransactions: Array<{
    type: string;
    date: string;
    amount: number;
    debit: boolean;
  }>;
}

export async function getDashboardUser(
  userId: string,
  hasApplied: boolean,
): Promise<DashboardUser | null> {
  const [user, application] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
      },
    }),
    prisma.application.findFirst({
      where: { userId },
      select: { id: true, status: true },
    }),
  ]);

  if (!user) return null;

  return {
    ...user,
    role: user.role,
    hasApplied,
    applicationStatus: application?.status ?? null,
  };
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
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

  const rejectedLoans = await prisma.loan.findMany({
    where: {
      userId,
      status: LoanStatus.REJECTED,
    },
    select: { id: true },
  });

  const supplyRequestAlerts = await prisma.supplyTransaction.findMany({
    where: {
      userId,
      status: {
        in: [TransactionStatus.APPROVED, TransactionStatus.REJECTED],
      },
    },
    select: { id: true },
  });

  const machineRequestAlerts = await prisma.machineRequest.findMany({
    where: {
      userId,
      status: {
        in: [MachineStatus.APPROVED, MachineStatus.REJECTED, MachineStatus.OVERDUE],
      },
    },
    select: { id: true },
  });

  const application = await prisma.application.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { guarantor: true },
  });
  const guarantor = application?.guarantor;
  const guarantorRecord =
    guarantor && typeof guarantor === "object"
      ? (guarantor as Record<string, unknown>)
      : null;
  const hasGuarantor = Boolean(
    guarantorRecord &&
      String(guarantorRecord.firstName ?? "").trim() &&
      String(guarantorRecord.lastName ?? "").trim(),
  );

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

  const loanDueAlerts = activeLoans.filter(
    (l) =>
      Number(l.amount) -
        l.payments.reduce((s, p) => s + Number(p.amount), 0) >
        0 && new Date(l.due) < new Date(),
  ).length;

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
      date: p.paidAt.toISOString(),
      amount: Number(p.amount),
      debit: true,
    })),
    ...supplyTransactions.map((t) => ({
      type:
        t.type === "LOAN"
          ? `Supply loan: ${t.supply.productName}`
          : `Purchase: ${t.supply.productName}`,
      date: t.createdAt.toISOString(),
      amount: Number(t.totalPrice),
      debit: true,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return {
    activeLoansCount,
    overdueLoansCount,
    borrowedMachinesCount,
    hasGuarantor,
    totalDebt,
    cashDebt,
    supplyDebt,
    rejectedLoanIds: rejectedLoans.map((l) => l.id),
    supplyRequestIds: supplyRequestAlerts.map((t) => t.id),
    machineRequestIds: machineRequestAlerts.map((r) => r.id),
    loanDueAlerts,
    nextPaymentDue: nextLoan?.due.toISOString() || null,
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
      nextPayment: l.due.toISOString(),
    })),
    recentTransactions: allTransactions,
  };
}

export interface ApplicationFeeStatus {
  application: {
    id: string;
    status: string;
    rejectionReason: string | null;
    rejectionDetails: string | null;
    reviewedAt: string | null;
    reviewedBy: {
      id: string;
      name: string | null;
      username: string;
      role: string;
    } | null;
  };
  fee: {
    amount: number;
  };
  payment: {
    id: string;
    status: string;
    amount: number;
    paymentMethod: string;
    referenceNo: string | null;
    receiptUrl: string | null;
    createdAt: string;
    verifiedAt: string | null;
    paidAt: string | null;
    rejectionReason: string | null;
    proofUploadedBy: {
      id: string;
      name: string | null;
      username: string;
      role: string;
    } | null;
    proofUploadedAt: string | null;
    verifiedBy: {
      id: string;
      name: string | null;
      username: string;
      role: string;
    } | null;
    declinedBy: {
      id: string;
      name: string | null;
      username: string;
      role: string;
    } | null;
    declinedAt: string | null;
  } | null;
  history: Array<{
    id: string;
    status: string;
    amount: number;
    paymentMethod: string;
    referenceNo: string | null;
    receiptUrl: string | null;
    createdAt: string;
    verifiedAt: string | null;
    paidAt: string | null;
    rejectionReason: string | null;
    proofUploadedBy: {
      id: string;
      name: string | null;
      username: string;
      role: string;
    } | null;
    proofUploadedAt: string | null;
    verifiedBy: {
      id: string;
      name: string | null;
      username: string;
      role: string;
    } | null;
    declinedBy: {
      id: string;
      name: string | null;
      username: string;
      role: string;
    } | null;
    declinedAt: string | null;
  }>;
}

export async function getApplicationFeeStatus(
  userId: string,
): Promise<ApplicationFeeStatus | null> {
  const application = await prisma.application.findFirst({
    where: { userId },
    select: {
      id: true,
      status: true,
      rejectionReason: true,
      rejectionDetails: true,
      reviewedAt: true,
      reviewedByUser: {
        select: { id: true, name: true, username: true, role: true },
      },
    },
  });
  if (!application) return null;

  const payments = await prisma.payment.findMany({
    where: {
      applicationId: application.id,
      type: PaymentType.APPLICATION_FEE,
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, username: true, role: true } },
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

  const serializePayment = (payment: (typeof payments)[number]) => ({
    id: payment.id,
    status: payment.status,
    amount: Number(payment.amount),
    paymentMethod: payment.paymentMethod,
    referenceNo: payment.referenceNo,
    receiptUrl: payment.receiptUrl,
    createdAt: payment.createdAt.toISOString(),
    verifiedAt: payment.verifiedAt?.toISOString() ?? null,
    paidAt: payment.paidAt?.toISOString() ?? null,
    rejectionReason: payment.rejectionReason,
    proofUploadedBy: payment.proofUploadedBy,
    proofUploadedAt: payment.proofUploadedAt?.toISOString() ?? null,
    verifiedBy: payment.verifiedByUser,
    declinedBy: payment.declinedByUser,
    declinedAt: payment.declinedAt?.toISOString() ?? null,
  });

  return {
    application: {
      id: application.id,
      status: application.status,
      rejectionReason: application.rejectionReason,
      rejectionDetails: application.rejectionDetails,
      reviewedAt: application.reviewedAt?.toISOString() ?? null,
      reviewedBy: application.reviewedByUser,
    },
    fee: {
      amount: getApplicationFeeAmount(),
    },
    payment: payments[0] ? serializePayment(payments[0]) : null,
    history: payments.map(serializePayment),
  };
}