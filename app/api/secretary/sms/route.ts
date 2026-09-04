import { SmsStatus } from "@/app/generated/prisma";
import { writeAudit } from "@/lib/activity";
import { apiErrorResponse, ApiError, readJsonBody, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { SMS_ROLES } from "@/lib/permissions";
import { createSmsTask, phoneFromContact } from "@/lib/services/sms";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const CreateSmsSchema = z
  .object({
    recipient: z.string().trim().min(1, "Recipient is required"),
    message: z.string().trim().min(1, "Message is required").max(500),
    userId: z.string().uuid().optional(),
    contact: z.string().nullable().optional(),
  })
  .strict();

export async function GET() {
  try {
    const { userId } = await requireUser(SMS_ROLES);
    const messages = await prisma.smsMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: {
          select: { id: true, name: true, username: true, role: true },
        },
        sentByUser: {
          select: { id: true, name: true, username: true, role: true },
        },
      },
    });
    return NextResponse.json({
      messages: messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString(), sentAt: m.sentAt?.toISOString() ?? null })),
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch SMS tasks");
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser(SMS_ROLES);
    const result = CreateSmsSchema.safeParse(await readJsonBody(req));
    if (!result.success) {
      throw new ApiError(400, result.error.issues[0].message);
    }

    const sms = await prisma.$transaction(async (tx) => {
      const created = await createSmsTask(tx, {
        recipient: result.data.recipient,
        message: result.data.message,
        userId: result.data.userId,
        createdBy: actor.userId,
        metadata: { contact: result.data.contact ?? result.data.recipient },
      });
      await writeAudit(tx, {
        userId: actor.userId,
        userRole: actor.userRole,
        action: "SMS_TASK_CREATED",
        entity: "SmsMessage",
        entityId: created.id,
        metadata: {
          recipient: created.recipient,
          userId: result.data.userId ?? null,
        },
      });
      return created;
    });

    return NextResponse.json({ message: "SMS task created", sms }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Failed to create SMS task");
  }
}
