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
  findSettledApplicationFee,
  getApplicationFeeAmount,
} from "@/lib/application-fee";
import {
  apiErrorResponse,
  ApiError,
  requireUser,
  requireUuid,
} from "@/lib/api";
import prisma from "@/lib/client";
import {
  readMultipartFormData,
  readProofOfPaymentFile,
  runReservedPaymentProofUpload,
  uploadPaymentProof,
} from "@/lib/payment-proof";

export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser([Role.PRESIDENT]);

    const formData = await readMultipartFormData(req);
    const applicationId = requireUuid(
      requireString(formData.get("applicationId"), "Application ID"),
      "Application ID",
    );
    const remarks = optionalString(formData.get("remarks"));
    const proof = formData.has("proofOfPayment")
      ? await readProofOfPaymentFile(formData)
      : null;

    const amount = getApplicationFeeAmount();

    await runReservedPaymentProofUpload({
      reserve: () => reserveOnSiteApplicationFee(applicationId, actor.userId, amount, remarks),
      upload: () =>
        proof ? uploadPaymentProof(proof) : Promise.resolve(""),
      complete: ({ id }, receiptUrl) =>
        completeOnSiteApplicationFee(
          id,
          actor.userId,
          applicationId,
          receiptUrl,
          remarks,
        ),
      release: async ({ id }) => {
        await prisma.payment.deleteMany({
          where: {
            id,
            applicationId,
            type: PaymentType.APPLICATION_FEE,
            status: PaymentStatus.VERIFIED,
            receiptUrl: null,
          },
        });
      },
    });

    return NextResponse.json({
      message: "On-site payment recorded and membership activated.",
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to record on-site payment");
  }
}

function requireString(value: FormDataEntryValue | null, subject: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(400, `${subject} is required`);
  }
  return value.trim();
}

function optionalString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 500)
    : null;
}

async function reserveOnSiteApplicationFee(
  applicationId: string,
  actorId: string,
  amount: number,
  remarks: string | null,
) {
  return prisma.$transaction(
    async (tx) => {
      const application = await tx.application.findUnique({
        where: { id: applicationId },
        select: { id: true, userId: true, status: true, fullName: true },
      });
      if (!application) throw new ApiError(404, "Application not found");
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
          applicationId,
          type: PaymentType.APPLICATION_FEE,
          status: {
            in: [PaymentStatus.PENDING, PaymentStatus.VERIFIED],
          },
        },
        select: { id: true },
      });
      if (existing) {
        throw new ApiError(
          409,
          "An application fee payment is already pending or approved for this application",
        );
      }

      const now = new Date();
      const payment = await tx.payment.create({
        data: {
          userId: application.userId,
          applicationId,
          type: PaymentType.APPLICATION_FEE,
          paymentMethod: PaymentMethod.ON_SITE,
          amount,
          status: PaymentStatus.VERIFIED,
          verifiedBy: actorId,
          verifiedAt: now,
          paidAt: now,
          remarks,
          createdById: actorId,
          createdByRole: Role.PRESIDENT,
          entryType: "MANUAL",
          initiatedBy: "SECRETARY",
          source: "OFFICE",
        },
        select: { id: true, applicationId: true, userId: true, status: true },
      });
      return payment;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function completeOnSiteApplicationFee(
  paymentId: string,
  actorId: string,
  applicationId: string,
  receiptUrl: string,
  remarks: string | null,
) {
  const hasProof = Boolean(receiptUrl);
  const requiredFee = getApplicationFeeAmount();
  await prisma.$transaction(
    async (tx) => {
      const updated = await tx.payment.updateMany({
        where: {
          id: paymentId,
          type: PaymentType.APPLICATION_FEE,
          status: PaymentStatus.VERIFIED,
        },
        data: {
          receiptUrl: hasProof ? receiptUrl : null,
          proofUploadedById: hasProof ? actorId : null,
          proofUploadedAt: hasProof ? new Date() : null,
        },
      });
      if (updated.count !== 1) {
        throw new ApiError(409, "Payment record changed during upload");
      }

      const application = await tx.application.findUnique({
        where: { id: applicationId },
        select: { userId: true, fullName: true, status: true },
      });

      // Recording a fee is not the same decision as granting membership. The
      // application moves into the President's review queue; only the
      // membership review endpoints promote it to APPROVED and set the member
      // role, and those endpoints re-verify this exact fee.
      //
      // The amount is re-read from the stored payment rather than from the
      // request body, so a fee recorded at the wrong amount cannot enter the
      // review queue on the strength of the requested figure.
      const settledFee = await tx.payment.findFirst({
        where: {
          id: paymentId,
          applicationId,
          type: PaymentType.APPLICATION_FEE,
          status: PaymentStatus.VERIFIED,
        },
        select: { status: true, amount: true },
      });
      if (
        !settledFee ||
        !findSettledApplicationFee([settledFee], requiredFee)
      ) {
        throw new ApiError(
          409,
          `The recorded application fee of ₱${requiredFee.toLocaleString()} has not been verified for this application.`,
        );
      }

      const claimed = await tx.application.updateMany({
        where: {
          id: applicationId,
          status: {
            in: [
              ApplicationStatus.PENDING,
              ApplicationStatus.PENDING_PAYMENT,
              ApplicationStatus.PENDING_APPLICATION_REVIEW,
            ],
          },
        },
        data: {
          status: ApplicationStatus.PENDING_APPLICATION_REVIEW,
        },
      });
      if (claimed.count === 0) {
        throw new ApiError(409, "Application is no longer awaiting review");
      }

      await writeAudit(tx, {
        userId: actorId,
        userRole: Role.PRESIDENT,
        action: "APPLICATION_FEE_RECORDED_ON_SITE",
        entity: "Application",
        entityId: applicationId,
        newStatus: ApplicationStatus.PENDING_APPLICATION_REVIEW,
      });

      await writeAudit(tx, {
        userId: actorId,
        action: "APPLICATION_FEE_RECORDED_ON_SITE",
        entity: "Payment",
        entityId: paymentId,
        metadata: {
          applicationId,
          amount: requiredFee,
          proofAttached: Boolean(receiptUrl),
          remarks,
        },
      });

      await notifyUser(tx, {
        userId: application!.userId,
        title: "Payment recorded",
        message:
          "Your on-site application fee payment was recorded. Your membership application is now awaiting the President's review.",
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}