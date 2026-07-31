import { NextRequest, NextResponse } from "next/server";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api";
import { MEMBER_ROLES } from "@/lib/permissions";
import {
  MachineRequestSchema,
  submitMachineRequest,
} from "@/lib/services/member-actions";
import { ONLINE_CONTEXT } from "@/lib/services/entry-context";

export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser(MEMBER_ROLES);
    const result = MachineRequestSchema.safeParse(await req.json());

    if (!result.success) {
      throw new ApiError(400, result.error.issues[0].message);
    }

    const request = await submitMachineRequest({
      actor,
      memberId: actor.userId,
      machineId: result.data.machineId,
      startDate: result.data.startDate,
      endDate: result.data.endDate,
      context: ONLINE_CONTEXT,
    });

    return NextResponse.json({
      message: "Borrow request submitted successfully",
      requestId: request.id,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to submit borrow request");
  }
}
