import {
  FarmOwnership,
  FarmSizeStatus,
  NotificationType,
  Prisma,
} from "@/app/generated/prisma";
import { notifyUser, writeActivityLog, writeAudit } from "@/lib/activity";
import { apiErrorResponse, ApiError, readJsonBody, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { MEMBERSHIP_ROLES } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((val) => (val ? val : undefined)),
}).strict();

const farmSizeLabel = (value: number | null) =>
  value == null ? "not set" : `${value} hectares`;

const ownership = (value: FarmOwnership) => {
  if (value === FarmOwnership.FARM_OWNER) return "farm owner";
  if (value === FarmOwnership.FARM_WORKER) return "farm worker / tenant";
  return "other farm role";
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser(MEMBERSHIP_ROLES);
    const result = ReviewSchema.safeParse(await readJsonBody(req));
    if (!result.success) {
      throw new ApiError(400, result.error.issues[0].message);
    }
    const { id: rawId } = await params;
    const approved = result.data.action === "approve";

    const resultRecord = await prisma.$transaction(
      async (tx) => {
        const app = await tx.application.findUnique({
          where: { id: rawId },
          include: { user: { select: { id: true, name: true } } },
        });
        if (!app) throw new ApiError(404, "Membership record not found");
        if (app.farmSizeStatus !== FarmSizeStatus.PENDING) {
          throw new ApiError(409, "There is no farm detail change waiting for review");
        }
        const requestedOwnership =
          app.pendingFarmOwnership ?? app.farmOwnership;
        const requestedFarmSize =
          requestedOwnership === FarmOwnership.FARM_WORKER
            ? null
            : app.pendingFarmSize;
        const requestedOwnershipDetails =
          requestedOwnership === FarmOwnership.OTHERS
            ? app.pendingFarmOwnershipDetails
            : null;

        const nextStatus = approved
          ? FarmSizeStatus.APPROVED
          : FarmSizeStatus.REJECTED;
        const previousFarmSize = app.farmSize;
        const previousOwnership = app.farmOwnership;
        const previousOwnershipDetails = app.farmOwnershipDetails;

        // On approval the requested value becomes the effective one and starts
        // granting machine-days straight away. On rejection it is discarded and
        // the member keeps whatever they had.
        const updated = await tx.application.update({
          where: { id: app.id },
          data: {
            farmSize: approved ? requestedFarmSize : previousFarmSize,
            farmOwnership: approved ? requestedOwnership : previousOwnership,
            farmOwnershipDetails: approved
              ? requestedOwnershipDetails
              : previousOwnershipDetails,
            pendingFarmSize: null,
            pendingFarmOwnership: null,
            pendingFarmOwnershipDetails: null,
            farmSizeStatus: nextStatus,
            farmSizeReviewedBy: actor.userId,
            farmSizeReviewedAt: new Date(),
            farmSizeRejectionReason: approved ? null : (result.data.reason ?? null),
          },
        });

        await notifyUser(tx, {
          userId: app.user.id,
          type: approved
            ? NotificationType.FARM_SIZE_APPROVED
            : NotificationType.FARM_SIZE_REJECTED,
          link: "/registration",
          title: approved ? "Farm details approved" : "Farm details change rejected",
          message: approved
            ? `Your farm role is now ${ownership(requestedOwnership)} and your farm size is ${farmSizeLabel(requestedFarmSize)}.`
            : result.data.reason
              ? `Your requested farm details were not approved. Reason: ${result.data.reason}. Your farm role and size on file are unchanged.`
              : "Your requested farm details were not approved. Your farm role and size on file are unchanged.",
        });

        await writeAudit(tx, {
          userId: actor.userId,
          userRole: actor.userRole,
          action: approved ? "FARM_SIZE_APPROVED" : "FARM_SIZE_REJECTED",
          entity: "Application",
          entityId: app.id,
          previousStatus: FarmSizeStatus.PENDING,
          newStatus: nextStatus,
          metadata: {
            previousFarmSize,
            requestedFarmSize,
            previousFarmOwnership: previousOwnership,
            requestedFarmOwnership: requestedOwnership,
            previousFarmOwnershipDetails: previousOwnershipDetails,
            requestedFarmOwnershipDetails: requestedOwnershipDetails,
            ...(result.data.reason ? { reason: result.data.reason } : {}),
          },
        });

        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await writeActivityLog({
      userId: actor.userId,
      action: approved ? "FARM_SIZE_APPROVED" : "FARM_SIZE_REJECTED",
      success: true,
      info: `Farm details for application ${rawId} ${result.data.action}d`,
    });

    return NextResponse.json({
      message:
        result.data.action === "approve"
          ? "Farm details approved"
          : "Farm details change rejected",
      status: resultRecord.farmSizeStatus,
      farmSize: resultRecord.farmSize,
      farmOwnership: resultRecord.farmOwnership,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to review farm detail change");
  }
}
