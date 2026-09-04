import { Prisma } from "@/app/generated/prisma";
import { writeAudit } from "@/lib/activity";
import { apiErrorResponse, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { OFFICER_ROLES } from "@/lib/permissions";
import {
  detectOverdueObligations,
  notifyOfficersOfOverdue,
} from "@/lib/services/overdue";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ScanSchema = z.object({
  autoMark: z.boolean().optional().default(false),
});

export async function GET() {
  try {
    const actor = await requireUser(OFFICER_ROLES);
    const overdue = await prisma.$transaction((tx) =>
      detectOverdueObligations(tx, { autoMark: false }),
    );
    return NextResponse.json({ generatedBy: actor.userId, overdue });
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch overdue obligations");
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser(OFFICER_ROLES);
    const body = await req.json().catch(() => ({}));
    const result = ScanSchema.safeParse(body);
    const autoMark = result.success ? result.data.autoMark : false;

    const overdue = await prisma.$transaction(
      async (tx) => {
        const found = await detectOverdueObligations(tx, { autoMark });
        await notifyOfficersOfOverdue(tx, found);
        await writeAudit(tx, {
          userId: actor.userId,
          userRole: actor.userRole,
          action: "OVERDUE_SCAN",
          entity: "System",
          metadata: {
            autoMark,
            count: found.length,
            kinds: Object.fromEntries(
              (["loan", "machine"] as const).map((kind) => [
                kind,
                found.filter((item) => item.kind === kind).length,
              ]),
            ),
          },
        });
        return found;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json({
      message: autoMark
        ? "Overdue scan completed and statuses updated"
        : "Overdue scan completed",
      overdue,
      count: overdue.length,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to scan overdue obligations");
  }
}
