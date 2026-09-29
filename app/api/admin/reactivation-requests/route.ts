import { NextResponse } from "next/server";

import { apiErrorResponse, requireUser } from "@/lib/api";
import { loadAccountStatus } from "@/lib/account-status";
import prisma from "@/lib/client";
import { REACTIVATION_REVIEW_ROLES } from "@/lib/account-status";

/**
 * Pending reactivation requests for the membership admin badge.
 *
 * Deliberately separate from `/api/admin/members`: the badge has to be correct
 * the moment an officer signs in, without first loading the whole member
 * directory. The President and Secretary are the roles that answer these, so
 * the Treasurer does not see the panel at all.
 */
export async function GET() {
  try {
    await requireUser(REACTIVATION_REVIEW_ROLES);

    const members = await prisma.user.findMany({
      where: { role: { in: [...REACTIVATION_REVIEW_ROLES, "MEMBER"] } },
      select: { id: true, name: true, username: true, role: true, active: true },
    });

    const statuses = await loadAccountStatus(members.map((m) => m.id));

    const requests = members
      .filter((member) => statuses.get(member.id)?.openReactivationRequest)
      .map((member) => {
        const status = statuses.get(member.id)!;
        return {
          id: member.id,
          name: member.name,
          username: member.username,
          role: member.role,
          active: member.active,
          requestedAt: status.openReactivationRequest!.at.toISOString(),
          message: status.openReactivationRequest!.message,
          deactivationReason: status.deactivationReason,
          deactivatedAt: status.deactivatedAt?.toISOString() ?? null,
        };
      })
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

    return NextResponse.json({ requests });
  } catch (error) {
    return apiErrorResponse(error, "Failed to load reactivation requests");
  }
}
