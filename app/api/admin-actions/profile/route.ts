import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse, ApiError, readJsonBody, requireUser } from "@/lib/api";
import { MEMBERSHIP_ROLES } from "@/lib/permissions";
import { MemberUpdateSchema, updateMemberRecord } from "@/lib/member-profile";
import { officeManualContext, OfficeActionSchema } from "@/lib/services/admin-actions";

const Schema = z
  .object({
    memberId: OfficeActionSchema.shape.memberId,
    source: OfficeActionSchema.shape.source,
    remarks: OfficeActionSchema.shape.remarks,
    reason: OfficeActionSchema.shape.reason,
    fields: MemberUpdateSchema,
  })
  .strict();

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireUser(MEMBERSHIP_ROLES);
    const result = Schema.safeParse(await readJsonBody(req));
    if (!result.success) {
      throw new ApiError(400, result.error.issues[0].message);
    }

    const { memberId, source, remarks, reason, fields } = result.data;

    const member = await updateMemberRecord({
      actorId: actor.userId,
      memberId,
      data: fields,
      extraMetadata: {
        manualContext: officeManualContext({ memberId, source, remarks, reason }),
      },
    });

    return NextResponse.json({
      message: "Member record updated",
      memberId: member.id,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to update member record");
  }
}
