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
import {
  currentInstance,
  isValidMonthDay,
  sortSeasons,
} from "@/lib/services/seasons";

const UpdateSeasonSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    startMonth: z.number().int().min(1).max(12).optional(),
    startDay: z.number().int().min(1).max(31).optional(),
  })
  .refine(
    (v) => v.name !== undefined || v.startMonth !== undefined || v.startDay !== undefined,
    { message: "Nothing to update" },
  );

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser([Role.PRESIDENT]);
    const id = requireUuid((await params).id, "Season ID");

    const parsed = UpdateSeasonSchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0].message);
    }

    const season = await prisma.season.findUnique({ where: { id } });
    if (!season) throw new ApiError(404, "Season not found");

    const startMonth = parsed.data.startMonth ?? season.startMonth;
    const startDay = parsed.data.startDay ?? season.startDay;
    if (!isValidMonthDay(startMonth, startDay)) {
      throw new ApiError(400, "Invalid season start date");
    }

    const peers = await prisma.season.findMany({
      where: { id: { not: id } },
      select: { startMonth: true, startDay: true },
    });
    const key = startMonth * 100 + startDay;
    if (peers.some((s) => s.startMonth * 100 + s.startDay === key)) {
      throw new ApiError(
        409,
        "Another season already starts on that date; move or remove it first",
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.season.update({
        where: { id },
        data: {
          name: parsed.data.name ?? season.name,
          startMonth,
          startDay,
        },
      });
      await writeAudit(tx, {
        userId: actor.userId,
        userRole: Role.PRESIDENT,
        action: "UPDATE",
        entity: "Season",
        entityId: id,
        previousStatus: `${season.name} @ ${season.startMonth}/${season.startDay}`,
        newStatus: `${result.name} @ ${result.startMonth}/${result.startDay}`,
      });
      return result;
    });

    return NextResponse.json({
      season: {
        id: updated.id,
        name: updated.name,
        startMonth: updated.startMonth,
        startDay: updated.startDay,
      },
      message:
        "Season updated. Boundary with the neighboring seasons adjusted automatically.",
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to update harvest season");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser([Role.PRESIDENT]);
    const id = requireUuid((await params).id, "Season ID");

    const season = await prisma.season.findUnique({ where: { id } });
    if (!season) throw new ApiError(404, "Season not found");

    const rows = await prisma.season.findMany({
      select: { id: true, name: true, startMonth: true, startDay: true },
    });
    const seasons = sortSeasons(
      rows.map(({ id: sid, name, startMonth, startDay }) => ({
        id: sid,
        name,
        startMonth,
        startDay,
      })),
    );

    const current = currentInstance(seasons);
    if (current && current.season.id === id) {
      throw new ApiError(
        409,
        "Cannot remove the season currently in progress. Its period merges into the previous season automatically; wait for it to end or move its start date first.",
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.season.delete({ where: { id } });
      await writeAudit(tx, {
        userId: actor.userId,
        userRole: Role.PRESIDENT,
        action: "DELETE",
        entity: "Season",
        entityId: id,
        previousStatus: `${season.name} @ ${season.startMonth}/${season.startDay}`,
      });
    });

    return NextResponse.json({
      message: "Season removed. Its period merges into the previous season.",
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to remove harvest season");
  }
}