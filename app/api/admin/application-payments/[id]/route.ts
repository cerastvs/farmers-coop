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
            ? PaymentStatus.VERIFIED
            : PaymentStatus.REJECTED;
        assertTransition(
          applicationFeePaymentTransitions,
          payment.status,
          nextStatus,
          "Application fee payment",
        );

        if (
          nextStatus === PaymentStatus.VERIFIED &&
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
            nextStatus === PaymentStatus.VERIFIED
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

        if (nextStatus === PaymentStatus.VERIFIED && payment.application) {
          const previousStatus = payment.application.status;

          // Verifying the fee moves the application into the President's review
          // queue — it does NOT grant membership by itself. Approving membership
          // is a separate, explicit decision (and the only thing that grants
          // member rights). Previously this single action both verified the fee
          // and approved the application, so membership was effectively
          // self-approving as soon as any fee was verified.
          const updated = await tx.application.updateMany({
            where: { id: payment.application.id },
            data: {
              status: ApplicationStatus.PENDING_APPLICATION_REVIEW,
            },
          });
          if (updated.count !== 1) {
            throw new ApiError(409, "Application status changed during review");
          }

          await writeAudit(tx, {
            userId: actor.userId,
            userRole: actor.userRole,
            action: "APPLICATION_FEE_VERIFIED_FOR_REVIEW",
            entity: "Application",
            entityId: payment.application.id,
            previousStatus,
            newStatus: ApplicationStatus.PENDING_APPLICATION_REVIEW,
          });

          // The application now waits on the President, so tell them.
          const presidents = await tx.user.findMany({
            where: { role: Role.PRESIDENT, active: true },
            select: { id: true },
          });
          await Promise.all(
            presidents.map((president) =>
              notifyUser(tx, {
                userId: president.id,
                title: "Membership application ready for review",
                message: `The application fee for ${payment.application!.fullName} has been verified. Their membership application is awaiting your decision.`,
              }),
            ),
          );
        }

        await notifyUser(tx, {
          userId: payment.userId,
          title:
            nextStatus === PaymentStatus.VERIFIED
              ? "Payment verified"
              : "Payment proof declined",
          message:
            nextStatus === PaymentStatus.VERIFIED
              ? "Your application fee payment was verified. Your membership application is now awaiting the President's review."
              : `Your submitted application fee proof could not be approved.${
                  result.data.reason
                    ? ` Reason: ${result.data.reason}`
                    : ""
                } Please submit a new payment proof.`,
        });
        await writeAudit(tx, {
          userId: actor.userId,
          action:
            nextStatus === PaymentStatus.VERIFIED
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
