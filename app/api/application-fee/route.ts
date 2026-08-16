import { NextRequest, NextResponse } from "next/server";

import {
  ApplicationStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  Prisma,
  Role,
} from "@/app/generated/prisma";
import { notifyUser, writeAudit } from "@/lib/activity";
import {
  getApplicationFeeAmount,
  readApplicationFeeSubmission,
} from "@/lib/application-fee";
import { apiErrorResponse, ApiError, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import {
  runReservedPaymentProofUpload,
  uploadPaymentProof,
} from "@/lib/payment-proof";

export async function GET() {
  try {
    const actor = await requireUser([Role.APPLICANT]);

    const application = await prisma.application.findFirst({
      where: { userId: actor.userId },
      select: { id: true, status: true },
    });
    if (!application) {
      throw new ApiError(404, "Application not found");
    }

    const payments = await prisma.payment.findMany({
      where: {
        applicationId: application.id,
        type: PaymentType.APPLICATION_FEE,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      application: {
        id: application.id,
        status: application.status,
      },
      fee: {
        amount: getApplicationFeeAmount(),
      },
      payment: payments[0] ?? null,
      history: payments.map((payment) => ({
        id: payment.id,
        status: payment.status,
        amount: Number(payment.amount),
        paymentMethod: payment.paymentMethod,
        referenceNo: payment.referenceNo,
        receiptUrl: payment.receiptUrl,
        createdAt: payment.createdAt.toISOString(),
        verifiedAt: payment.verifiedAt?.toISOString() ?? null,
        rejectionReason: payment.rejectionReason,
      })),
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch application fee status");
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser([Role.APPLICANT]);
    const submission = await readApplicationFeeSubmission(req);

    if (submission.paymentMethod !== PaymentMethod.ONLINE) {
      throw new ApiError(
        400,
        "On-site payments are recorded by cooperative staff instead.",
      );
    }

    const feeAmount = getApplicationFeeAmount();

    const payment = await runReservedPaymentProofUpload({
      reserve: () => reserveApplicationFeePayment(actor.userId, feeAmount),
      upload: () => uploadPaymentProof(submission.proofOfPayment),
      complete: (paymentId, receiptUrl) =>
        completeApplicationFeePayment(
          paymentId,
          actor.userId,
          feeAmount,
          receiptUrl,
          submission.referenceNo,
        ),
      release: async (paymentId) => {
        await prisma.payment.deleteMany({
          where: {
            id: paymentId,
            userId: actor.userId,
            type: PaymentType.APPLICATION_FEE,
            status: PaymentStatus.PENDING_APPROVAL,
            receiptUrl: null,
          },
        });
      },
    });

    return NextResponse.json(
      {
        message: "Payment proof submitted for verification",
        paymentId: payment.id,
      },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to submit application fee payment");
  }
}

async function reserveApplicationFeePayment(userId: string, amount: number) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const application = await tx.application.findFirst({
          where: { userId },
          select: { id: true, status: true },
        });
        if (!application) {
          throw new ApiError(404, "Application not found");
        }
        if (
          application.status !== ApplicationStatus.PENDING_PAYMENT &&
          application.status !== ApplicationStatus.PENDING
        ) {
          throw new ApiError(
            409,
            "This application no longer requires an application fee payment",
          );
        }

        const existing = await tx.payment.findFirst({
          where: {
            applicationId: application.id,
            type: PaymentType.APPLICATION_FEE,
            status: { in: [PaymentStatus.PENDING_APPROVAL, PaymentStatus.APPROVED] },
          },
          select: { id: true },
        });
        if (existing) {
          throw new ApiError(
            409,
            "A payment proof is already pending or was approved for this application",
          );
        }

        const reservation = await tx.payment.create({
          data: {
            userId,
            applicationId: application.id,
            type: PaymentType.APPLICATION_FEE,
            paymentMethod: PaymentMethod.ONLINE,
            amount,
            status: PaymentStatus.PENDING_APPROVAL,
          },
          select: { id: true },
        });
        return reservation.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ApiError(
        409,
        "A payment proof is already pending for this application",
      );
    }
    throw error;
  }
}

async function completeApplicationFeePayment(
  paymentId: string,
  userId: string,
  amount: number,
  receiptUrl: string,
  referenceNo: string | undefined,
) {
  return prisma.$transaction(
    async (tx) => {
      const completed = await tx.payment.updateMany({
        where: {
          id: paymentId,
          userId,
          type: PaymentType.APPLICATION_FEE,
          status: PaymentStatus.PENDING_APPROVAL,
          receiptUrl: null,
        },
        data: { receiptUrl, referenceNo },
      });
      if (completed.count !== 1) {
        throw new ApiError(409, "Payment reservation changed during upload");
      }

      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        select: { id: true, applicationId: true },
      });

      await writeAudit(tx, {
        userId,
        action: "APPLICATION_FEE_PROOF_SUBMITTED",
        entity: "Payment",
        entityId: paymentId,
        metadata: {
          applicationId: payment?.applicationId,
          amount,
          proofAttached: true,
        },
      });
      await notifyUser(tx, {
        userId,
        title: "Payment proof submitted",
        message:
          "Your application fee proof was submitted. The President will verify it.",
      });

      const presidents = await tx.user.findMany({
        where: { role: Role.PRESIDENT, active: true },
        select: { id: true },
      });
      await Promise.all(
        presidents.map((president) =>
          notifyUser(tx, {
            userId: president.id,
            title: "Application fee awaiting approval",
            message: `An application fee proof of ₱${amount.toLocaleString()} is ready for your review.`,
          }),
        ),
      );

      return { id: paymentId };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
