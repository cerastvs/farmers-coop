import { z } from "zod";

import {
  LoanStatus,
  LoanType,
  MachineStatus,
  NotificationType,
  PaymentStatus,
  PaymentType,
  Prisma,
  Role,
  SupplyTransactionType,
  TransactionStatus,
} from "@/app/generated/prisma";
import { notifyUser, writeAudit } from "@/lib/activity";
import { ApiError } from "@/lib/errors";
import prisma from "@/lib/client";
import { calculateLoanDueDate } from "@/lib/lifecycles";
import {
  auditMetadata,
  ManualContext,
  manualCreateData,
} from "@/lib/services/entry-context";
import {
  applyVerifiedLoanPayment,
  generateReceiptNo,
} from "@/lib/services/loan-payments";
import { requiredDurationDays } from "@/lib/services/overdue";

export const LoanRequestSchema = z
  .object({
    amount: z.number().positive().max(5000).multipleOf(0.01),
    termMonths: z.number().int().min(6).max(24),
    purpose: z.string().trim().min(10).max(500),
    type: z.enum(["SUPPLY", "MONEY"]).default("MONEY"),
  })
  .strict();

export const MachineRequestSchema = z
  .object({
    machineId: z.string().uuid(),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
  })
  .strict();

export const SupplyRequestSchema = z
  .object({
    supplyId: z.string().uuid(),
    quantity: z.number().int().positive().max(2_147_483_647),
    type: z.nativeEnum(SupplyTransactionType),
  })
  .strict();

export const ManualPaymentSchema = z
  .object({
    type: z.nativeEnum(PaymentType),
    loanId: z.string().uuid().optional(),
    amount: z.number().positive().max(999_999_999.99).multipleOf(0.01),
  })
  .strict()
  .refine(
    (value) =>
      value.type !== PaymentType.LOAN_PAYMENT || value.loanId !== undefined,
    "loanId is required for loan payments",
  );

type Actor = { userId: string; userRole: Role };

const ACTIVE_LOAN_STATUSES = [
  LoanStatus.PENDING,
  LoanStatus.APPROVED,
  LoanStatus.ACTIVE,
];

const BLOCKING_MACHINE_STATUSES = [
  MachineStatus.APPROVED,
  MachineStatus.IN_USE,
  MachineStatus.OVERDUE,
];

const OPEN_SUPPLY_STATUSES = [
  TransactionStatus.PENDING,
  TransactionStatus.APPROVED,
];

async function requireActiveMember(tx: Prisma.TransactionClient, memberId: string) {
  const member = await tx.user.findUnique({
    where: { id: memberId },
    select: { id: true, role: true, active: true, name: true },
  });
  if (!member) throw new ApiError(404, "Member not found");
  if (!member.active) throw new ApiError(409, "Member account is inactive");
  if (member.role === Role.APPLICANT) {
    throw new ApiError(409, "Applicant is not an approved member");
  }
  return member;
}

export async function submitLoanRequest({
  actor,
  memberId,
  input,
  context,
}: {
  actor: Actor;
  memberId: string;
  input: z.infer<typeof LoanRequestSchema>;
  context: ManualContext;
}) {
  return prisma.$transaction(
    async (tx) => {
      await requireActiveMember(tx, memberId);

      const isSupply = input.type === "SUPPLY";
      const existing = await tx.loan.findFirst({
        where: {
          userId: memberId,
          status: { in: ACTIVE_LOAN_STATUSES },
          ...(isSupply ? { type: LoanType.SUPPLY } : {}),
        },
        select: { id: true, type: true },
      });
      if (existing) {
        const kind = existing.type === LoanType.SUPPLY ? "supply" : "cash";
        throw new ApiError(
          409,
          `Member already has a pending or active ${kind} loan account`,
        );
      }

      const due = calculateLoanDueDate(new Date(), input.termMonths);

      const created = await tx.loan.create({
        data: {
          userId: memberId,
          name: input.type === LoanType.SUPPLY ? "Farm Supply Loan" : "Cash Loan",
          amount: input.amount,
          termMonths: input.termMonths,
          purpose: input.purpose,
          type: input.type,
          due,
          ...manualCreateData(actor.userId, actor.userRole, context),
        },
      });

      await tx.loanStatusHistory.create({
        data: { loanId: created.id, status: LoanStatus.PENDING },
      });

      const audit = await writeAudit(tx, {
        userId: actor.userId,
        userRole: actor.userRole,
        action: "LOAN_REQUESTED",
        entity: "Loan",
        entityId: created.id,
        newStatus: LoanStatus.PENDING,
        metadata: auditMetadata(context, {
          memberId,
          amount: input.amount,
          termMonths: input.termMonths,
          type: input.type,
        }),
      });
      await tx.loan.update({
        where: { id: created.id },
        data: { auditId: audit.id },
      });

      const reviewers = await tx.user.findMany({
        where: {
          role: { in: [Role.TREASURER, Role.PRESIDENT] },
          active: true,
        },
        select: { id: true },
      });
      await Promise.all(
        reviewers.map((reviewer) =>
          notifyUser(tx, {
            userId: reviewer.id,
            type: input.type === LoanType.SUPPLY ? "SUPPLY_REQUEST" : "LOAN_APPROVAL",
            link: "/dashboard/treasurer?section=loans",
            title: "New loan request",
            message: `A ₱${input.amount.toLocaleString()} ${input.type === "SUPPLY" ? "supply" : "cash"}-loan request is ready for review.`,
          }),
        ),
      );

      return created;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function submitMachineRequest({
  actor,
  memberId,
  machineId,
  startDate,
  endDate,
  context,
}: {
  actor: Actor;
  memberId: string;
  machineId: string;
  startDate: string;
  endDate: string;
  context: ManualContext;
}) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ApiError(400, "Invalid date format");
  }
  if (end < start) {
    throw new ApiError(400, "End date must be on or after start date");
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  if (startStr < todayStr) {
    throw new ApiError(400, "Start date cannot be in the past");
  }

  return prisma.$transaction(
    async (tx) => {
      await requireActiveMember(tx, memberId);

      const application = await tx.application.findFirst({
        where: { userId: memberId },
        select: { farmSize: true },
      });
      const farmSize = application?.farmSize ?? 1;
      const requiredDays = requiredDurationDays(farmSize);

      const machine = await tx.machine.findUnique({
        where: { id: machineId },
        include: {
          requests: {
            where: { status: { in: BLOCKING_MACHINE_STATUSES } },
            select: { startDate: true, endDate: true },
          },
        },
      });
      if (!machine) throw new ApiError(404, "Machine not found");

      const hasOverlap = machine.requests.some((r) => {
        if (!r.startDate || !r.endDate) return false;
        return start <= r.endDate && end >= r.startDate;
      });
      if (hasOverlap) {
        throw new ApiError(
          409,
          "Selected dates overlap with an existing booking",
        );
      }

      const requestedDays =
        Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) +
        1;
      if (requestedDays > requiredDays) {
        throw new ApiError(
          400,
          `A ${farmSize} ha farm allows at most ${requiredDays} day(s) of machine use (1 day per hectare)`,
        );
      }

      const created = await tx.machineRequest.create({
        data: {
          userId: memberId,
          machineId,
          farmSize,
          durationDays: requestedDays,
          status: MachineStatus.QUEUED,
          startDate: start,
          endDate: end,
          ...manualCreateData(actor.userId, actor.userRole, context),
        },
      });

      const audit = await writeAudit(tx, {
        userId: actor.userId,
        userRole: actor.userRole,
        action: "MACHINE_REQUESTED",
        entity: "MachineRequest",
        entityId: created.id,
        newStatus: MachineStatus.QUEUED,
        metadata: auditMetadata(context, {
          memberId,
          machineId,
          farmSize,
          durationDays: requestedDays,
          startDate,
          endDate,
        }),
      });
      await tx.machineRequest.update({
        where: { id: created.id },
        data: { auditId: audit.id },
      });

      const reviewers = await tx.user.findMany({
        where: { role: Role.SECRETARY, active: true },
        select: { id: true },
      });
      await Promise.all(
        reviewers.map((reviewer) =>
          notifyUser(tx, {
            userId: reviewer.id,
            type: NotificationType.MACHINE_REQUEST,
            link: "/dashboard/secretary?section=machines",
            title: "New machine request",
            message: `A request for ${machine.name} is ready for review.`,
          }),
        ),
      );

      return created;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function submitSupplyTransaction({
  actor,
  memberId,
  supplyId,
  quantity,
  type,
  context,
}: {
  actor: Actor;
  memberId: string;
  supplyId: string;
  quantity: number;
  type: SupplyTransactionType;
  context: ManualContext;
}) {
  return prisma.$transaction(
    async (tx) => {
      await requireActiveMember(tx, memberId);

      const supply = await tx.supply.findUnique({
        where: { id: supplyId },
      });
      if (!supply) throw new ApiError(404, "Supply not found");
      if (quantity > supply.quantity) {
        throw new ApiError(
          400,
          "Requested quantity exceeds available stock",
        );
      }

      if (
        type === SupplyTransactionType.LOAN &&
        supply.loanLimitPerHectare != null
      ) {
        const application = await tx.application.findFirst({
          where: { userId: memberId },
          select: { farmSize: true },
        });
        if (!application) {
          throw new ApiError(
            400,
            "No application on file — cannot verify farm size",
          );
        }
        const maxAllowed = Math.floor(
          application.farmSize * supply.loanLimitPerHectare,
        );

        const existingLoanQty = await tx.supplyTransaction.aggregate({
          where: {
            userId: memberId,
            supplyId: supply.id,
            type: SupplyTransactionType.LOAN,
            status: { in: OPEN_SUPPLY_STATUSES },
          },
          _sum: { quantity: true },
        });
        const alreadyLoaned = existingLoanQty._sum.quantity ?? 0;
        const remaining = maxAllowed - alreadyLoaned;
        if (remaining <= 0) {
          throw new ApiError(
            400,
            `Loan limit reached — member can borrow at most ${maxAllowed} units of ${supply.productName} for a ${application.farmSize} ha farm`,
          );
        }
        if (quantity > remaining) {
          throw new ApiError(
            400,
            `Member can only borrow ${remaining} more units of ${supply.productName} (limit: ${supply.loanLimitPerHectare} per ha × ${application.farmSize} ha = ${maxAllowed} total, ${alreadyLoaned} already loaned)`,
          );
        }
      }

      const duplicate = await tx.supplyTransaction.findFirst({
        where: {
          userId: memberId,
          supplyId: supply.id,
          status: { in: OPEN_SUPPLY_STATUSES },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ApiError(
          409,
          "Member already has an open request for this item",
        );
      }

      const totalPrice = supply.price.mul(quantity);
      if (totalPrice.greaterThan(new Prisma.Decimal("99999999.99"))) {
        throw new ApiError(400, "Request total exceeds the supported limit");
      }

      const created = await tx.supplyTransaction.create({
        data: {
          userId: memberId,
          supplyId: supply.id,
          quantity,
          totalPrice,
          type,
          ...manualCreateData(actor.userId, actor.userRole, context),
        },
      });

      const audit = await writeAudit(tx, {
        userId: actor.userId,
        userRole: actor.userRole,
        action: "SUPPLY_REQUESTED",
        entity: "SupplyTransaction",
        entityId: created.id,
        newStatus: TransactionStatus.PENDING,
        metadata: auditMetadata(context, {
          memberId,
          supplyId: supply.id,
          quantity,
          type,
        }),
      });
      await tx.supplyTransaction.update({
        where: { id: created.id },
        data: { auditId: audit.id },
      });

      const reviewers = await tx.user.findMany({
        where: {
          role: { in: [Role.SECRETARY, Role.TREASURER] },
          active: true,
        },
        select: { id: true },
      });
      await Promise.all(
        reviewers.map((reviewer) =>
          notifyUser(tx, {
            userId: reviewer.id,
            type: NotificationType.SUPPLY_REQUEST,
            link: "/dashboard/secretary?section=supplies",
            title: "New supply request",
            message: `A request for ${quantity} ${supply.productName} is ready for review.`,
          }),
        ),
      );

      return created;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function recordManualPayment({
  actor,
  memberId,
  type,
  loanId,
  amount,
  proofUrl,
  context,
}: {
  actor: Actor;
  memberId: string;
  type: PaymentType;
  loanId?: string;
  amount: number;
  proofUrl?: string | null;
  context: ManualContext;
}) {
  return prisma.$transaction(
    async (tx) => {
      await requireActiveMember(tx, memberId);

      const manual = manualCreateData(actor.userId, actor.userRole, context);

      if (type === PaymentType.LOAN_PAYMENT) {
        if (!loanId) {
          throw new ApiError(400, "loanId is required for loan payments");
        }

        const loan = await tx.loan.findFirst({
          where: { id: loanId, userId: memberId },
        });
        if (!loan) throw new ApiError(404, "Loan not found");
        if (
          loan.status !== LoanStatus.ACTIVE &&
          loan.status !== LoanStatus.OVERDUE
        ) {
          throw new ApiError(409, "Only active loans can receive payments");
        }

        const payment = await tx.payment.create({
          data: {
            userId: memberId,
            loanId,
            type: PaymentType.LOAN_PAYMENT,
            amount,
            status: PaymentStatus.VERIFIED,
            verifiedBy: actor.userId,
            verifiedAt: new Date(),
            receiptNo: generateReceiptNo(memberId + loanId + amount),
            receiptUrl: proofUrl ?? null,
            ...manual,
          },
        });

        const paymentWithLoan = await tx.payment.findUniqueOrThrow({
          where: { id: payment.id },
          include: {
            loan: { include: { payments: true } },
          },
        });

        await applyVerifiedLoanPayment(tx, paymentWithLoan);

        const audit = await writeAudit(tx, {
          userId: actor.userId,
          userRole: actor.userRole,
          action: "PAYMENT_RECORDED_MANUAL",
          entity: "Payment",
          entityId: payment.id,
          newStatus: PaymentStatus.VERIFIED,
          metadata: auditMetadata(context, {
            memberId,
            loanId,
            amount,
            receiptNo: payment.receiptNo,
            proofAttached: Boolean(proofUrl),
          }),
        });
        await tx.payment.update({
          where: { id: payment.id },
          data: { auditId: audit.id },
        });

        await notifyUser(tx, {
          userId: memberId,
          type: NotificationType.LOAN_PAYMENT_RECEIVED,
          link: "/dashboard",
          title: "Payment received",
          message: `Your ₱${amount.toLocaleString()} loan payment was recorded in the office and applied to your account.`,
        });

        return payment;
      }

      const payment = await tx.payment.create({
        data: {
          userId: memberId,
          type,
          amount,
          status: PaymentStatus.VERIFIED,
          verifiedBy: actor.userId,
          verifiedAt: new Date(),
          receiptNo: generateReceiptNo(memberId + type + amount),
          receiptUrl: proofUrl ?? null,
          ...manual,
        },
      });

      const audit = await writeAudit(tx, {
        userId: actor.userId,
        userRole: actor.userRole,
        action: "PAYMENT_RECORDED_MANUAL",
        entity: "Payment",
        entityId: payment.id,
        newStatus: PaymentStatus.VERIFIED,
        metadata: auditMetadata(context, {
          memberId,
          type,
          amount,
          receiptNo: payment.receiptNo,
          proofAttached: Boolean(proofUrl),
        }),
      });
      await tx.payment.update({
        where: { id: payment.id },
        data: { auditId: audit.id },
      });

      await notifyUser(tx, {
        userId: memberId,
        type: NotificationType.PAYMENT_RECEIVED,
        link: "/dashboard",
        title: "Payment received",
        message: `Your ₱${amount.toLocaleString()} ${type.replace("_", " ").toLowerCase()} was recorded in the office.`,
      });

      return payment;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
