import { GuarantorStatus, NotificationType, Role } from "@/app/generated/prisma";
import { writeActivityLog, writeAudit } from "@/lib/activity";
import { apiErrorResponse, ApiError, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const actor = await requireUser([Role.APPLICANT, Role.MEMBER]);

    const app = await prisma.application.findFirst({
      where: { userId: actor.userId },
    });
    if (!app) throw new ApiError(404, "Application not found");
    if (!app.guarantor || typeof app.guarantor !== "object") {
      throw new ApiError(409, "You have no guarantor on file");
    }
    if (app.guarantorStatus === GuarantorStatus.APPROVED) {
      throw new ApiError(409, "Your guarantor is already approved");
    }
    if (app.guarantorStatus !== GuarantorStatus.REJECTED) {
      return NextResponse.json({
        success: true,
        status: GuarantorStatus.PENDING,
        message: "Your guarantor is already under review",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: app.id },
        data: {
          guarantorStatus: GuarantorStatus.PENDING,
          guarantorReviewedBy: null,
          guarantorReviewedAt: null,
          guarantorRejectionReason: null,
        },
      });
      await tx.notification.create({
        data: {
          userId: actor.userId,
          type: NotificationType.SYSTEM,
          link: "/dashboard",
          title: "Guarantor resubmitted",
          message:
            "Your guarantor has been resubmitted for review. The president or treasurer will verify it again.",
        },
      });
      await writeAudit(tx, {
        userId: actor.userId,
        userRole: actor.userRole,
        action: "GUARANTOR_RESUBMITTED",
        entity: "Application",
        entityId: app.id,
        previousStatus: GuarantorStatus.REJECTED,
        newStatus: GuarantorStatus.PENDING,
      });
    });

    await writeActivityLog({
      userId: actor.userId,
      action: "GUARANTOR_RESUBMITTED",
      success: true,
      info: `Guarantor for application ${app.id} resubmitted for review`,
    });

    return NextResponse.json({ success: true, status: GuarantorStatus.PENDING });
  } catch (error) {
    return apiErrorResponse(error, "Failed to resubmit guarantor");
  }
}