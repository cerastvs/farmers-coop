import { FarmSizeStatus } from "@/app/generated/prisma";
import { apiErrorResponse, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { MEMBERSHIP_ROLES } from "@/lib/permissions";
import { NextResponse } from "next/server";

/**
 * The queue of members asking for a different farm size.
 *
 * Farm size cannot be changed by the member themselves because one hectare is
 * one machine-day, so approving one of these hands out machine capacity and can
 * raise a supply loan cap. The member's current size keeps applying until an
 * officer decides.
 */
export async function GET() {
  try {
    await requireUser(MEMBERSHIP_ROLES);

    const applications = await prisma.application.findMany({
      where: {
        farmSizeStatus: FarmSizeStatus.PENDING,
        pendingFarmSize: { not: null },
        user: { role: { in: ["MEMBER", "APPLICANT"] } },
      },
      orderBy: { farmSizeReviewedAt: "asc" },
      include: {
        user: { select: { id: true, name: true, username: true, role: true } },
      },
    });

    return NextResponse.json({
      pending: applications.map((a) => ({
        applicationId: a.id,
        member: {
          id: a.user.id,
          name: a.user.name ?? a.user.username,
          username: a.user.username,
          role: a.user.role,
        },
        fullName: a.fullName,
        // What the member is asking for, and what they have on file now. The
        // officer needs both: the second is what still grants the allowance.
        requestedFarmSize: a.pendingFarmSize,
        currentFarmSize: a.farmSize,
        farmOwnership: a.farmOwnership,
        farmOwnershipDetails: a.farmOwnershipDetails,
        // One hectare is one machine-day, so the change is a change in how many
        // machine-days the member may book this season.
        machineDayChange:
          a.pendingFarmSize != null && a.farmSize != null
            ? Math.ceil(a.pendingFarmSize) - Math.ceil(a.farmSize)
            : null,
      })),
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch farm size approvals");
  }
}
