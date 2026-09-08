import { NextRequest, NextResponse } from "next/server";

import {
  ApplicationStatus,
  PaymentStatus,
  PaymentType,
  Prisma,
  Role,
} from "@/app/generated/prisma";
import { notifyUser, writeAudit } from "@/lib/activity";
import {
  apiErrorResponse,
  ApiError,
  readJsonBody,
  requireUser,
  requireUuid,
} from "@/lib/api";
import prisma from "@/lib/client";
import {
  assertTransition,
  applicationFeePaymentTransitions,
} from "@/lib/lifecycles";
import { FINANCE_ROLES } from "@/lib/permissions";
import { z } from "zod";

const ReviewSchema = z
  .object({
    action: z.enum(["approve", "decline"]),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser(FINANCE_ROLES);
    const result = ReviewSchema.safeParse(await readJsonBody(req));
    if (!result.success) {
      throw new ApiError(400, result.error.issues[0].message);
    }

    const { id: rawId } = await params;
    const id = requireUuid(rawId, "Payment ID");

    await prisma.$transaction(
      async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { id },
          include: {
            application: {
              select: { id: true, userId: true, status: true, fullName: true },
            },
          },
        });
        if (!payment) throw new ApiError(404, "Application fee payment not found");
        if (payment.type !== PaymentType.APPLICATION_FEE) {
          throw new ApiError(409, "This is not an application fee payment");
        }

        const nextStatus =
          result.data.action === "approve"
            ? PaymentStatus.APPROVED
            : PaymentStatus.REJECTED;
        assertTransition(
          applicationFeePaymentTransitions,
          payment.status,
          nextStatus,
          "Application fee payment",
        );

        if (
          nextStatus === PaymentStatus.APPROVED &&
          payment.paymentMethod === "ONLINE" &&
          !payment.receiptUrl
        ) {
          throw new ApiError(
            409,
            "Online payments cannot be approved without proof of payment",
          );
        }

        const now = new Date();
        const claimed = await tx.payment.updateMany({
          where: { id, status: payment.status },
          data:
            nextStatus === PaymentStatus.APPROVED
              ? {
                  status: nextStatus,
                  verifiedBy: actor.userId,
                  verifiedAt: now,
                  paidAt: now,
                  declinedById: null,
                  declinedAt: null,
                  rejectionReason: null,
                }
              : {
                  status: nextStatus,
                  declinedById: actor.userId,
                  declinedAt: now,
                  rejectionReason: result.data.reason ?? null,
                },
        });
        if (claimed.count !== 1) {
          throw new ApiError(409, "Payment status changed during review");
        }

        if (nextStatus === PaymentStatus.APPROVED && payment.application) {
          const previousStatus = payment.application.status;
          const updated = await tx.application.updateMany({
            where: { id: payment.application.id },
            data: {
              status: ApplicationStatus.APPROVED,
              reviewedBy: actor.userId,
              reviewedAt: now,
            },
          });
          if (updated.count !== 1) {
            throw new ApiError(409, "Application status changed during review");
          }

          await tx.user.updateMany({
            where: { id: payment.application.userId },
            data: { role: Role.MEMBER, active: true },
          });

          await writeAudit(tx, {
            userId: actor.userId,
            userRole: actor.userRole,
            action: "MEMBERSHIP_APPLICATION_APPROVED",
            entity: "Application",
            entityId: payment.application.id,
            previousStatus,
            newStatus: ApplicationStatus.APPROVED,
          });
        }

        await notifyUser(tx, {
          userId: payment.userId,
          title:
            nextStatus === PaymentStatus.APPROVED
              ? "Membership approved"
              : "Payment proof declined",
          message:
            nextStatus === PaymentStatus.APPROVED
              ? "Congratulations! Your application fee payment was verified. You are now an official member of the cooperative."
              : `Your submitted application fee proof could not be approved.${
                  result.data.reason
                    ? ` Reason: ${result.data.reason}`
                    : ""
                } Please submit a new payment proof.`,
        });
        await writeAudit(tx, {
          userId: actor.userId,
          action:
            nextStatus === PaymentStatus.APPROVED
              ? "APPLICATION_FEE_APPROVED"
              : "APPLICATION_FEE_DECLINED",
          entity: "Payment",
          entityId: payment.id,
          metadata: {
            applicationId: payment.applicationId,
            reason: result.data.reason ?? undefined,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json({
      message:
        result.data.action === "approve"
          ? "Payment approved and membership activated."
          : "Payment proof declined.",
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to review application fee payment");
  }
}
