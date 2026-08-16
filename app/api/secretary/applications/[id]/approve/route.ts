import { NextResponse } from "next/server";

import { ApplicationStatus, Role } from "@/app/generated/prisma";
import { notifyUser, writeAudit } from "@/lib/activity";
import { apiErrorResponse, ApiError, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { MEMBERSHIP_ROLES } from "@/lib/permissions";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser(MEMBERSHIP_ROLES);
    const { id } = await params;
    const application = await prisma.application.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        fullName: true,
        status: true,
      },
    });

    if (!application) {
      throw new ApiError(404, "Application not found");
    }

    if (
      application.status !== ApplicationStatus.PENDING &&
      application.status !== ApplicationStatus.PENDING_APPLICATION_REVIEW
    ) {
      throw new ApiError(409, "Application is already processed");
    }

    const reviewedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id },
        data: {
          status: ApplicationStatus.APPROVED,
          reviewedBy: actor.userId,
          reviewedAt,
          rejectionReason: null,
        },
      });
      await tx.user.update({
        where: { id: application.userId },
        data: {
          role: Role.MEMBER,
          active: true,
        },
      });
      await notifyUser(tx, {
        userId: application.userId,
        title: "Membership approved",
        message:
          "Your cooperative membership application was approved. Member services are now available.",
      });
      await writeAudit(tx, {
        userId: actor.userId,
        action: "MEMBERSHIP_APPLICATION_APPROVED",
        entity: "Application",
        entityId: id,
        metadata: {
          applicantUserId: application.userId,
          reviewedAt: reviewedAt.toISOString(),
        },
      });
    });

    return NextResponse.json({
      success: true,
      status: ApplicationStatus.APPROVED,
      reviewedAt,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to approve application");
  }
}
