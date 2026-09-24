import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ApiError,
  apiErrorResponse,
  readJsonBody,
  requireUuid,
  requireUser,
} from "@/lib/api";
import prisma from "@/lib/client";
import { Role } from "@/app/generated/prisma";
import { writeAudit } from "@/lib/activity";

const CapacitySchema = z.object({
  capacities: z
    .array(
      z.object({
        machineId: z.string().uuid("Invalid machine ID"),
        maxHectareDays: z
          .union([z.number().nonnegative("Capacity cannot be negative"), z.null()])
          .optional(),
      }),
    )
    .min(1),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser([Role.PRESIDENT]);
    const seasonId = requireUuid((await params).id, "Season ID");

    const parsed = CapacitySchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0].message);
    }

    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) throw new ApiError(404, "Season not found");

    const machineIds = parsed.data.capacities.map((c) => c.machineId);
    const existingMachines = await prisma.machine.findMany({
      where: { id: { in: machineIds } },
      select: { id: true },
    });
    if (existingMachines.length !== machineIds.length) {
      throw new ApiError(400, "One or more machines do not exist");
    }

    await prisma.$transaction(async (tx) => {
      for (const { machineId, maxHectareDays } of parsed.data.capacities) {
        await tx.machineSeasonCapacity.upsert({
          where: {
            seasonId_machineId: { seasonId, machineId },
          },
          create: {
            seasonId,
            machineId,
            maxHectareDays: maxHectareDays ?? null,
          },
          update: { maxHectareDays: maxHectareDays ?? null },
        });
      }
      await writeAudit(tx, {
        userId: actor.userId,
        userRole: Role.PRESIDENT,
        action: "UPDATE",
        entity: "SeasonCapacity",
        entityId: seasonId,
        metadata: { capacities: parsed.data.capacities },
      });
    });

    return NextResponse.json({
      message:
        "Capacity limits saved. They are shared across all members for this season and reset when the next season begins.",
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to save season capacity");
  }
}