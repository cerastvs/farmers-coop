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
import { getApplicationFeeAmount } from "@/lib/application-fee";
import {
  apiErrorResponse,
  ApiError,
  readJsonBody,
  requireUser,
  requireUuid,
} from "@/lib/api";
import prisma from "@/lib/client";
import { z } from "zod";

const RecordOnSiteSchema = z
  .object({
    applicationId: z.string().uuid(),
    remarks: z.string().trim().max(500).optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser([Role.PRESIDENT]);
    const result = RecordOnSiteSchema.safeParse(await readJsonBody(req));
    if (!result.success) {
      throw new ApiError(400, result.error.issues[0].message);
    }

    const applicationId = requireUuid(result.data.applicationId, "Application ID");
    const amount = getApplicationFeeAmount();

    await prisma.$transaction(
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
              in: [PaymentStatus.PENDING_APPROVAL, PaymentStatus.APPROVED],
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

        const payment = await tx.payment.create({
          data: {
            userId: application.userId,
            applicationId,
            type: PaymentType.APPLICATION_FEE,
            paymentMethod: PaymentMethod.ON_SITE,
            amount,
            status: PaymentStatus.APPROVED,
            verifiedBy: actor.userId,
            verifiedAt: new Date(),
            remarks: result.data.remarks ?? null,
          },
          select: { id: true },
        });

        await tx.application.update({
          where: { id: applicationId },
          data: { status: ApplicationStatus.PENDING_APPLICATION_REVIEW },
        });

        await writeAudit(tx, {
          userId: actor.userId,
          action: "APPLICATION_FEE_RECORDED_ON_SITE",
          entity: "Payment",
          entityId: payment.id,
          metadata: {
            applicationId,
            amount,
            remarks: result.data.remarks,
          },
        });

        const reviewers = await tx.user.findMany({
          where: { role: Role.SECRETARY, active: true },
          select: { id: true },
        });
        await Promise.all([
          notifyUser(tx, {
            userId: application.userId,
            title: "Payment approved",
            message:
              "Your on-site application fee payment was recorded. Your application will now proceed to the next stage.",
          }),
          ...reviewers.map((reviewer) =>
            notifyUser(tx, {
              userId: reviewer.id,
              title: "Application ready for review",
              message: `${application.fullName}'s application fee was verified on-site and the application is ready for review.`,
            }),
          ),
        ]);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json({
      message: "On-site payment recorded and application advanced.",
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to record on-site payment");
  }
}
