import { NextResponse } from "next/server";

import { Role } from "@/app/generated/prisma";
import { apiErrorResponse, ApiError, requireUser } from "@/lib/api";
import { recordReactivation } from "@/lib/account-status";
import { notifyUser } from "@/lib/activity";
import prisma from "@/lib/client";
import { RECORDS_ROLES } from "@/lib/permissions";

/**
 * An officer restores a disabled member's account.
 *
 * Reactivation closes any open request automatically: the newest account event
 * becomes MEMBER_REACTIVATED, so the request stops counting against the
 * membership admin badge with no separate "dismiss" step to forget.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser(RECORDS_ROLES);
    const { id } = await params;

    if (id === actor.userId) {
      throw new ApiError(409, "This is your own account");
    }

    const member = await prisma.user.findUnique({
      where: { id },
      select: { id: true, active: true, name: true, username: true },
    });
    if (!member) throw new ApiError(404, "Member not found");
    if (member.active) {
      throw new ApiError(409, "This account is already active");
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: member.id },
        data: { active: true },
      });
      await recordReactivation(tx, {
        actorId: actor.userId,
        actorRole: actor.userRole as Role,
        memberId: member.id,
      });
      await notifyUser(tx, {
        userId: member.id,
        title: "Your account has been reactivated",
        message:
          "A cooperative officer has reactivated your account. You have full access to the cooperative again.",
        link: "/dashboard",
      });
    });

    return NextResponse.json({
      message: `${member.name ?? member.username} has been reactivated.`,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to reactivate member");
  }
}
