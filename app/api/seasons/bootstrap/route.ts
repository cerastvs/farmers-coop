import { NextResponse } from "next/server";

import { ApiError, apiErrorResponse, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { Role } from "@/app/generated/prisma";
import { writeAudit } from "@/lib/activity";
import { sortSeasons } from "@/lib/services/seasons";

export async function POST() {
  try {
    const actor = await requireUser([Role.PRESIDENT]);
    const count = await prisma.season.count();
    if (count > 0) {
      throw new ApiError(409, "Seasons already configured");
    }

    const seasons = await prisma.$transaction(async (tx) => {
      const [wet, dry] = await Promise.all([
        tx.season.create({ data: { name: "Wet Season", startMonth: 5, startDay: 1 } }),
        tx.season.create({ data: { name: "Dry Season", startMonth: 11, startDay: 1 } }),
      ]);

      await writeAudit(tx, {
        userId: actor.userId,
        userRole: Role.PRESIDENT,
        action: "BOOTSTRAP",
        entity: "Season",
        metadata: { names: ["Wet Season", "Dry Season"] },
      });

      return sortSeasons([wet, dry]);
    });

    return NextResponse.json(
      { seasons, message: "Default Wet and Dry seasons created." },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to set up default seasons");
  }
}