import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, apiErrorResponse, readJsonBody, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { Role } from "@/app/generated/prisma";
import { writeAudit } from "@/lib/activity";
import {
  computeCapacityUsage,
  getCapacityMembers,
  getSeasonOverview,
  isValidMonthDay,
} from "@/lib/services/seasons";

const CreateSeasonSchema = z.object({
  name: z.string().trim().min(1, "Season name is required").max(60),
  startMonth: z.number().int().min(1).max(12),
  startDay: z.number().int().min(1).max(31),
});

function serializeSeason(overview: Awaited<ReturnType<typeof getSeasonOverview>>) {
  return {
    seasons: overview.seasons.map((s) => ({
      id: s.id,
      name: s.name,
      startMonth: s.startMonth,
      startDay: s.startDay,
    })),
    current: overview.current
      ? {
          id: overview.current.season.id,
          name: overview.current.season.name,
          start: overview.current.start.toISOString(),
          end: overview.current.end.toISOString(),
        }
      : null,
    next: overview.next
      ? {
          id: overview.next.season.id,
          name: overview.next.season.name,
          start: overview.next.start.toISOString(),
          end: overview.next.end.toISOString(),
        }
      : null,
  };
}

interface CapacityRow {
  seasonId: string;
  userId: string;
  name: string;
  limitHectareDays: number | null;
  bookedHectareDays: number;
  remaining: number | null;
  utilizationPercent: number | null;
}

export async function GET() {
  try {
    await requireUser([Role.PRESIDENT]);

    const [overview, members] = await Promise.all([
      getSeasonOverview(),
      getCapacityMembers(),
    ]);

    const capacityRows = await computeCapacityUsage(overview.seasons);

    const booked = new Map<string, number>();
    for (const row of capacityRows) {
      booked.set(`${row.seasonId}:${row.userId}`, row.bookedHectareDays);
    }

    const capacity: CapacityRow[] = [];
    for (const season of overview.seasons) {
      for (const member of members) {
        const limit = member.farmHectares > 0 ? member.farmHectares : null;
        const b = booked.get(`${season.id}:${member.id}`) ?? 0;
        capacity.push({
          seasonId: season.id,
          userId: member.id,
          name: member.name,
          limitHectareDays: limit,
          bookedHectareDays: b,
          remaining: limit === null ? null : Math.max(0, limit - b),
          utilizationPercent: limit === null ? null : Math.min(100, Math.round((b / limit) * 100)),
        });
      }
    }

    return NextResponse.json({
      ...serializeSeason(overview),
      members,
      capacity,
      empty: overview.seasons.length === 0,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to load harvest seasons");
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireUser([Role.PRESIDENT]);
    const parsed = CreateSeasonSchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0].message);
    }
    const { name, startMonth, startDay } = parsed.data;
    if (!isValidMonthDay(startMonth, startDay)) {
      throw new ApiError(400, "Invalid season start date");
    }

    const existing = await prisma.season.findMany({
      select: { startMonth: true, startDay: true },
    });
    const key = startMonth * 100 + startDay;
    if (existing.some((s) => s.startMonth * 100 + s.startDay === key)) {
      throw new ApiError(
        409,
        "A season already starts on that date; move or remove it first",
      );
    }

    const season = await prisma.$transaction(async (tx) => {
      const created = await tx.season.create({
        data: { name, startMonth, startDay },
      });
      await writeAudit(tx, {
        userId: actor.userId,
        userRole: Role.PRESIDENT,
        action: "CREATE",
        entity: "Season",
        entityId: created.id,
        metadata: { name, startMonth, startDay },
      });
      return created;
    });

    return NextResponse.json(
      {
        season: { id: season.id, name, startMonth, startDay },
        message: "Season created. It runs from its start date until the next season begins.",
      },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to create harvest season");
  }
}