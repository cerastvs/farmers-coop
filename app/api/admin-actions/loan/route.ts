import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse, ApiError, readJsonBody, requireUser } from "@/lib/api";
import { MEMBERSHIP_ROLES } from "@/lib/permissions";
import { LoanRequestSchema, submitLoanRequest } from "@/lib/services/member-actions";
import {
  officeManualContext,
  OfficeActionSchema,
} from "@/lib/services/admin-actions";

const Schema = LoanRequestSchema.extend({
  memberId: OfficeActionSchema.shape.memberId,
  source: OfficeActionSchema.shape.source,
  remarks: OfficeActionSchema.shape.remarks,
  reason: OfficeActionSchema.shape.reason,
}).strict();

export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser(MEMBERSHIP_ROLES);
    const result = Schema.safeParse(await readJsonBody(req));
    if (!result.success) {
      throw new ApiError(400, result.error.issues[0].message);
    }

    const { memberId, source, remarks, reason, ...input } = result.data;

    const loan = await submitLoanRequest({
      actor,
      memberId,
      input,
      context: officeManualContext({ memberId, source, remarks, reason }),
    });

    return NextResponse.json(
      { message: "Loan request recorded", loanId: loan.id },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to record loan request");
  }
}
