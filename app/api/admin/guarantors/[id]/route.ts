import {
  GuarantorStatus,
  NotificationType,
  Prisma,
} from "@/app/generated/prisma";
import { notifyUser, writeActivityLog, writeAudit } from "@/lib/activity";
import { apiErrorResponse, ApiError, readJsonBody, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { FINANCE_ROLES } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().min(1).max(500).optional(),
}).strict();

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
    if (result.data.action === "reject" && !result.data.reason) {
      throw new ApiError(400, "A rejection reason is required");
    }

    const { id: rawId } = await params;

    const resultRecord = await prisma.$transaction(
      async (tx) => {
        const app = await tx.application.findUnique({
          where: { id: rawId },
          include: { user: { select: { id: true, name: true } } },
        });
        if (!app) throw new ApiError(404, "Membership record not found");
        if (!app.guarantor || typeof app.guarantor !== "object") {
          throw new ApiError(409, "This member has no guarantor on file");
        }

        const nextStatus =
          result.data.action === "approve"
            ? GuarantorStatus.APPROVED
            : GuarantorStatus.REJECTED;

        const updated = await tx.application.update({
          where: { id: app.id },
          data: {
            guarantorStatus: nextStatus,
            guarantorReviewedBy: actor.userId,
            guarantorReviewedAt: new Date(),
            guarantorRejectionReason:
              nextStatus === GuarantorStatus.REJECTED
                ? result.data.reason
                : null,
          },
        });

        await tx.notification.create({
          data: {
            userId: app.user.id,
            type:
              nextStatus === GuarantorStatus.APPROVED
                ? NotificationType.GUARANTOR_APPROVED
                : NotificationType.GUARANTOR_REJECTED,
            link: "/dashboard",
            title:
              nextStatus === GuarantorStatus.APPROVED
                ? "Guarantor approved"
                : "Guarantor request rejected",
            message:
              nextStatus === GuarantorStatus.APPROVED
                ? "Your guarantor has been verified and approved. You can now apply for loans."
                : `Your guarantor request was rejected. Reason: ${result.data.reason}. Please update your guarantor in Edit Profile and wait for review.`,
          },
        });

        await writeAudit(tx, {
          userId: actor.userId,
          userRole: actor.userRole,
          action:
            nextStatus === GuarantorStatus.APPROVED
              ? "GUARANTOR_APPROVED"
              : "GUARANTOR_REJECTED",
          entity: "Application",
          entityId: app.id,
          previousStatus: GuarantorStatus.PENDING,
          newStatus: nextStatus,
          metadata: result.data.reason
            ? { reason: result.data.reason }
            : undefined,
        });

        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await writeActivityLog({
      userId: actor.userId,
      action:
        result.data.action === "approve"
          ? "GUARANTOR_APPROVED"
          : "GUARANTOR_REJECTED",
      success: true,
      info: `Guarantor for application ${rawId} ${result.data.action}d`,
    });

    return NextResponse.json({
      message:
        result.data.action === "approve"
          ? "Guarantor approved"
          : "Guarantor rejected",
      status: resultRecord.guarantorStatus,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to review guarantor");
  }
}