import {
  FarmOwnership,
  FarmSizeStatus,
  NotificationType,
  Role,
} from "@/app/generated/prisma";
import { notifyUser, writeActivityLog, writeAudit } from "@/lib/activity";
import { apiErrorResponse, ApiError, readJsonBody, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { needsFarmProfileReview } from "@/lib/farm-access-core";
import { NextRequest } from "next/server";
import { z } from "zod";

const FarmDetailsSchema = z
  .object({
    farmSize: z.number().positive().nullable(),
    farmOwnership: z.enum(["FARM_OWNER", "FARM_WORKER", "OTHERS"]),
    farmOwnershipDetails: z.string().trim().max(200).nullable(),
  })
  .strict();

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireUser([Role.APPLICANT, Role.MEMBER]);
    const parsed = FarmDetailsSchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0].message);
    }

    const application = await prisma.application.findFirst({
      where: { userId: actor.userId },
    });
    if (!application) throw new ApiError(404, "Application not found");

    const requestedOwnership = parsed.data.farmOwnership as FarmOwnership;
    const requestedFarmSize =
      requestedOwnership === FarmOwnership.FARM_WORKER
        ? null
        : parsed.data.farmSize;
    const requestedOwnershipDetails =
      requestedOwnership === FarmOwnership.OTHERS
        ? parsed.data.farmOwnershipDetails || null
        : null;
    const needsReview = needsFarmProfileReview(
      {
        farmSize: application.farmSize,
        farmOwnership: application.farmOwnership,
        farmOwnershipDetails: application.farmOwnershipDetails,
      },
      {
        farmSize: requestedFarmSize,
        farmOwnership: requestedOwnership,
        farmOwnershipDetails: requestedOwnershipDetails,
      },
    );
    const cancelled =
      !needsReview && application.farmSizeStatus === FarmSizeStatus.PENDING;
    const matchesPendingRequest =
      application.farmSizeStatus === FarmSizeStatus.PENDING &&
      application.pendingFarmOwnership !== null &&
      !needsFarmProfileReview(
        {
          farmSize: application.pendingFarmSize,
          farmOwnership: application.pendingFarmOwnership,
          farmOwnershipDetails: application.pendingFarmOwnershipDetails,
        },
        {
          farmSize: requestedFarmSize,
          farmOwnership: requestedOwnership,
          farmOwnershipDetails: requestedOwnershipDetails,
        },
      );

    if (matchesPendingRequest) {
      return Response.json({
        success: true,
        pending: true,
        cancelled: false,
        message: "Farm changes are already waiting for review.",
      });
    }

    if (!needsReview && !cancelled) {
      return Response.json({
        success: true,
        pending: false,
        cancelled: false,
        message: "Farm details are unchanged.",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: application.id },
        data: needsReview
          ? {
              pendingFarmSize: requestedFarmSize,
              pendingFarmOwnership: requestedOwnership,
              pendingFarmOwnershipDetails: requestedOwnershipDetails,
              farmSizeStatus: FarmSizeStatus.PENDING,
              farmSizeReviewedBy: null,
              farmSizeReviewedAt: null,
              farmSizeRejectionReason: null,
            }
          : {
              pendingFarmSize: null,
              pendingFarmOwnership: null,
              pendingFarmOwnershipDetails: null,
              farmSizeStatus: null,
              farmSizeReviewedBy: null,
              farmSizeReviewedAt: null,
              farmSizeRejectionReason: null,
            },
      });

      await writeAudit(tx, {
        userId: actor.userId,
        userRole: actor.userRole,
        action: cancelled
          ? "FARM_DETAILS_CHANGE_CANCELLED"
          : "FARM_DETAILS_CHANGE_REQUESTED",
        entity: "Application",
        entityId: application.id,
        previousStatus: application.farmSizeStatus ?? undefined,
        newStatus: needsReview ? FarmSizeStatus.PENDING : undefined,
        metadata: {
          currentFarmSize: application.farmSize,
          requestedFarmSize,
          currentFarmOwnership: application.farmOwnership,
          requestedFarmOwnership: requestedOwnership,
        },
      });
      await notifyUser(tx, {
        userId: actor.userId,
        type: NotificationType.SYSTEM,
        link: "/registration",
        title: cancelled
          ? "Farm detail request cancelled"
          : "Farm details sent for review",
        message: cancelled
          ? "Your pending farm role and size change was cancelled."
          : "Your requested farm role and size are with an officer for review. Your current farm access remains active until approval.",
      });
    });

    await writeActivityLog({
      userId: actor.userId,
      action: cancelled
        ? "FARM_DETAILS_CHANGE_CANCELLED"
        : "FARM_DETAILS_CHANGE_REQUESTED",
      success: true,
      info: `Farm details for application ${application.id} ${cancelled ? "cancelled" : "submitted for review"}`,
    });

    return Response.json({
      success: true,
      pending: needsReview,
      cancelled,
      message: cancelled
        ? "Pending farm changes cancelled."
        : needsReview
          ? "Farm changes saved and sent for review."
          : "Farm details are unchanged.",
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to update farm details");
  }
}
