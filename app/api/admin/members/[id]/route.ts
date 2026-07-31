import { Prisma } from "@/app/generated/prisma";
import { NextRequest, NextResponse } from "next/server";

import { apiErrorResponse, ApiError, requireUser } from "@/lib/api";
import { RECORDS_ROLES } from "@/lib/permissions";
import {
  MemberUpdateSchema,
  updateMemberRecord,
} from "@/lib/member-profile";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser(RECORDS_ROLES);
    const { id } = await params;
    const parsed = MemberUpdateSchema.safeParse(await req.json());

    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0].message);
    }

    const member = await updateMemberRecord({
      actorId: actor.userId,
      memberId: id,
      data: parsed.data,
    });

    const { applications, ...safeMember } = member;
    return NextResponse.json({
      message: "Member record updated",
      member: {
        ...safeMember,
        application: applications[0] ?? null,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return apiErrorResponse(
        new ApiError(409, "Username is already taken"),
        "Failed to update member record",
      );
    }
    return apiErrorResponse(error, "Failed to update member record");
  }
}
