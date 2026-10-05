import { FarmOwnership, FarmSizeStatus } from "@/app/generated/prisma";
import { apiErrorResponse, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { MEMBERSHIP_ROLES } from "@/lib/permissions";
import { NextResponse } from "next/server";

/**
 * The queue of members asking for different farm details.
 *
 * Farm role and size jointly control machine access and per-hectare supply
 * limits. The member's current farm details keep applying until an officer
 * decides.
 */
export async function GET() {
  try {
    await requireUser(MEMBERSHIP_ROLES);

    const applications = await prisma.application.findMany({
      where: {
        farmSizeStatus: FarmSizeStatus.PENDING,
        pendingFarmOwnership: { not: null },
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
        currentFarmOwnership: a.farmOwnership,
        currentFarmOwnershipDetails: a.farmOwnershipDetails,
        requestedFarmOwnership: a.pendingFarmOwnership,
        requestedFarmOwnershipDetails: a.pendingFarmOwnershipDetails,
        // Farm workers have no machine-day allowance even when a legacy farm
        // size remains on their record.
        machineDayChange:
          (a.pendingFarmOwnership === FarmOwnership.FARM_WORKER
            ? 0
            : Math.ceil(a.pendingFarmSize ?? 0)) -
          (a.farmOwnership === FarmOwnership.FARM_WORKER
            ? 0
            : Math.ceil(a.farmSize ?? 0)),
      })),
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch farm size approvals");
  }
}
