import { SmsStatus } from "@/app/generated/prisma";
import { writeAudit } from "@/lib/activity";
import { apiErrorResponse, ApiError, readJsonBody, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { SMS_ROLES } from "@/lib/permissions";
import { failSmsRecord, sendSmsRecord } from "@/lib/services/sms";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const UpdateSmsSchema = z
  .object({
    action: z.enum(["send", "fail"]),
    error: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine(
    (value) => value.action !== "fail" || Boolean(value.error),
    "An error message is required when marking an SMS as failed",
  );

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser(SMS_ROLES);
    const result = UpdateSmsSchema.safeParse(await readJsonBody(req));
    if (!result.success) {
      throw new ApiError(400, result.error.issues[0].message);
    }

    const { id } = await params;
    const sms = await prisma.$transaction(async (tx) => {
      let updated;
      if (result.data.action === "send") {
        updated = await sendSmsRecord(tx, id, actor.userId);
      } else {
        updated = await failSmsRecord(tx, id, result.data.error!);
      }
      await writeAudit(tx, {
        userId: actor.userId,
        userRole: actor.userRole,
        action:
          updated.status === SmsStatus.SENT ? "SMS_MARKED_SENT" : "SMS_MARKED_FAILED",
        entity: "SmsMessage",
        entityId: id,
        previousStatus: "PENDING",
        newStatus: updated.status,
        metadata: updated.error ? { error: updated.error } : undefined,
      });
      return updated;
    });

    return NextResponse.json({
      message:
        sms.status === SmsStatus.SENT
          ? "SMS marked as sent"
          : "SMS marked as failed",
      sms,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to update SMS task");
  }
}
