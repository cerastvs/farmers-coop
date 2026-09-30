import { FarmSizeStatus, NotificationType, Prisma } from "@/app/generated/prisma";
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

const hectares = (value: number | null) => (value == null ? "none" : `${value}`);

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
          throw new ApiError(409, "There is no farm size change waiting for review");
        }
        if (app.pendingFarmSize == null) {
          throw new ApiError(409, "There is no farm size change waiting for review");
        }

        const nextStatus = approved
          ? FarmSizeStatus.APPROVED
          : FarmSizeStatus.REJECTED;
        const previousFarmSize = app.farmSize;

        // On approval the requested value becomes the effective one and starts
        // granting machine-days straight away. On rejection it is discarded and
        // the member keeps whatever they had.
        const updated = await tx.application.update({
          where: { id: app.id },
          data: {
            farmSize: approved ? app.pendingFarmSize : previousFarmSize,
            pendingFarmSize: null,
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
          title: approved ? "Farm size approved" : "Farm size change rejected",
          message: approved
            ? `Your farm size is now ${hectares(app.pendingFarmSize)} hectares. This sets how many machine-days you may book.`
            : result.data.reason
              ? `Your requested farm size of ${hectares(app.pendingFarmSize)} hectares was not approved. Reason: ${result.data.reason}. Your farm size on file is unchanged.`
              : `Your requested farm size of ${hectares(app.pendingFarmSize)} hectares was not approved. Your farm size on file is unchanged.`,
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
            requestedFarmSize: app.pendingFarmSize,
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
      info: `Farm size for application ${rawId} ${result.data.action}d`,
    });

    return NextResponse.json({
      message:
        result.data.action === "approve"
          ? "Farm size approved"
          : "Farm size change rejected",
      status: resultRecord.farmSizeStatus,
      farmSize: resultRecord.farmSize,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to review farm size change");
  }
}
