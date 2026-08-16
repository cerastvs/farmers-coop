import { NextResponse } from "next/server";
import { z } from "zod";

import { ApplicationStatus, Role } from "@/app/generated/prisma";
import { notifyUser, writeAudit } from "@/lib/activity";
import { apiErrorResponse, ApiError, requireUser } from "@/lib/api";
import prisma from "@/lib/client";

const RejectApplicationSchema = z
  .object({
    reason: z.string().trim().min(3).max(500).optional(),
    rejectionReason: z.string().trim().min(3).max(500).optional(),
  })
  .refine((value) => value.reason || value.rejectionReason, {
    message: "Rejection reason is required",
  });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser([Role.PRESIDENT]);
    const parsed = RejectApplicationSchema.safeParse(
      await req.json().catch(() => ({})),
    );
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0].message);
    }

    const rejectionReason = (
      parsed.data.reason ?? parsed.data.rejectionReason
    )!;
    const { id } = await params;
    const application = await prisma.application.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
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
          status: ApplicationStatus.REJECTED,
          reviewedBy: actor.userId,
          reviewedAt,
          rejectionReason,
        },
      });
      await notifyUser(tx, {
        userId: application.userId,
        title: "Membership application update",
        message: `Your membership application was not approved. Reason: ${rejectionReason}`,
      });
      await writeAudit(tx, {
        userId: actor.userId,
        action: "MEMBERSHIP_APPLICATION_REJECTED",
        entity: "Application",
        entityId: id,
        metadata: {
          applicantUserId: application.userId,
          rejectionReason,
          reviewedAt: reviewedAt.toISOString(),
        },
      });
    });

    return NextResponse.json({
      success: true,
      status: ApplicationStatus.REJECTED,
      rejectionReason,
      reviewedAt,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to reject application");
  }
}
