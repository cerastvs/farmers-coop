import {
  LoanStatus,
  PaymentStatus,
  PaymentType,
  Prisma,
  Role,
} from "@/app/generated/prisma";
import { notifyUser, writeAudit } from "@/lib/activity";
import {
  apiErrorResponse,
  ApiError,
  requireUser,
} from "@/lib/api";
import prisma from "@/lib/client";
import {
  readPaymentSubmission,
  runReservedPaymentProofUpload,
  uploadPaymentProof,
} from "@/lib/payment-proof";
import { MEMBER_ROLES } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const actor = await requireUser(MEMBER_ROLES);
    const payments = await prisma.payment.findMany({
      where: { userId: actor.userId },
      orderBy: { createdAt: "desc" },
      include: { loan: { select: { name: true } } },
    });

    return NextResponse.json(
      payments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
      })),
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch payments");
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser(MEMBER_ROLES);
    const submission = await readPaymentSubmission(req);

    const payment = await runReservedPaymentProofUpload({
      reserve: () =>
        reservePayment(actor.userId, submission.loanId, submission.amount),
      upload: () => uploadPaymentProof(submission.proofOfPayment),
      complete: (paymentId, receiptUrl) =>
        completePayment(
          paymentId,
          actor.userId,
          submission.loanId,
          submission.amount,
          receiptUrl,
        ),
      release: async (paymentId) => {
        await prisma.payment.deleteMany({
          where: {
            id: paymentId,
            userId: actor.userId,
            status: PaymentStatus.PENDING,
            receiptUrl: null,
            referenceNo: null,
          },
        });
      },
    });

    return NextResponse.json(
      { message: "Payment submitted for verification", paymentId: payment.id },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to submit payment");
  }
}

type LoanForPayment = {
  status: LoanStatus;
  amount: Prisma.Decimal;
  payments: { amount: Prisma.Decimal }[];
} | null;

function assertPaymentFitsLoan(
  loan: LoanForPayment,
  amount: number,
): asserts loan is NonNullable<LoanForPayment> {
  if (!loan) throw new ApiError(404, "Loan not found");
  if (loan.status !== LoanStatus.ACTIVE) {
    throw new ApiError(409, "Only active loans can receive payments");
  }

  const paid = loan.payments.reduce(
    (sum, entry) => sum.plus(entry.amount),
    new Prisma.Decimal(0),
  );
  const balance = loan.amount.minus(paid);
  if (new Prisma.Decimal(amount).greaterThan(balance)) {
    throw new ApiError(
      400,
      `Payment cannot exceed the remaining balance of ₱${balance.toNumber().toLocaleString()}`,
    );
  }
}

async function reservePayment(
  userId: string,
  loanId: string,
  amount: number,
) {
  return prisma.$transaction(
    async (tx) => {
      const loan = await tx.loan.findFirst({
        where: { id: loanId, userId },
        include: { payments: true },
      });
      assertPaymentFitsLoan(loan, amount);

      const reservation = await tx.payment.create({
        data: {
          userId,
          loanId,
          type: PaymentType.LOAN_PAYMENT,
          amount,
        },
        select: { id: true },
      });
      return reservation.id;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function completePayment(
  paymentId: string,
  userId: string,
  loanId: string,
  amount: number,
  receiptUrl: string,
) {
  return prisma.$transaction(
    async (tx) => {
      const loan = await tx.loan.findFirst({
        where: { id: loanId, userId },
        include: { payments: true },
      });
      assertPaymentFitsLoan(loan, amount);

      const completed = await tx.payment.updateMany({
        where: {
          id: paymentId,
          userId,
          loanId,
          type: PaymentType.LOAN_PAYMENT,
          status: PaymentStatus.PENDING,
          receiptUrl: null,
          referenceNo: null,
        },
        data: { receiptUrl },
      });
      if (completed.count !== 1) {
        throw new ApiError(409, "Payment reservation changed during upload");
      }

      await writeAudit(tx, {
        userId,
        action: "PAYMENT_SUBMITTED",
        entity: "Payment",
        entityId: paymentId,
        metadata: {
          loanId,
          amount,
          proofAttached: true,
        },
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
            title: "Payment awaiting verification",
            message: `A ₱${amount.toLocaleString()} loan payment is ready for review.`,
          }),
        ),
      );

      return { id: paymentId };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
