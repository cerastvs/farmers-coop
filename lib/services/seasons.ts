import { MachineStatus, Prisma, Role } from "@/app/generated/prisma";
import client from "@/lib/client";

export interface SeasonLike {
  id: string;
  name: string;
  startMonth: number;
  startDay: number;
}

export interface SeasonInstance {
  season: SeasonLike;
  year: number;
  start: Date;
  end: Date;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function seasonMonthDayKey(season: SeasonLike) {
  return season.startMonth * 100 + season.startDay;
}

export function isValidMonthDay(month: number, day: number) {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  const maxDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= maxDays;
}

export function seasonStartForYear(season: SeasonLike, year: number) {
  return new Date(year, season.startMonth - 1, season.startDay, 0, 0, 0, 0);
}

export function sortSeasons<T extends SeasonLike>(seasons: T[]) {
  return [...seasons].sort(
    (a, b) => seasonMonthDayKey(a) - seasonMonthDayKey(b),
  );
}

/**
 * The end of a season occurrence that starts in `year` is the start of the
 * next season in the annual cycle (wrapping around to the next year).
 * Coverage of the whole year is guaranteed by construction.
 */
export function periodFor(
  seasons: SeasonLike[],
  startIndex: number,
  year: number,
) {
  const sorted = sortSeasons(seasons);
  const nextIndex = (startIndex + 1) % sorted.length;
  const nextYear = year + (nextIndex === 0 ? 1 : 0);
  const next = sorted[nextIndex];
  const nextStart = seasonStartForYear(next, nextYear);
  return { next, nextStart, end: nextStart };
}

function instanceFor(
  seasons: SeasonLike[],
  startIndex: number,
  year: number,
): SeasonInstance {
  const sorted = sortSeasons(seasons);
  const season = sorted[startIndex];
  const start = seasonStartForYear(season, year);
  const { end } = periodFor(sorted, startIndex, year);
  return { season, year, start, end };
}

/**
 * The lifecycle occurrence currently in progress at `date` (or null when no
 * seasons are configured).
 */
export function currentInstance(
  seasons: SeasonLike[],
  date: Date = new Date(),
): SeasonInstance | null {
  const sorted = sortSeasons(seasons);
  if (sorted.length === 0) return null;

  const day = startOfDay(date);
  let best: { index: number; year: number; startTime: number } | null = null;

  for (let i = 0; i < sorted.length; i++) {
    for (const year of [day.getFullYear() - 1, day.getFullYear()]) {
      const start = seasonStartForYear(sorted[i], year);
      if (start.getTime() <= day.getTime() && start.getTime() > (best?.startTime ?? -Infinity)) {
        best = { index: i, year, startTime: start.getTime() };
      }
    }
  }

  if (!best) return null;
  return instanceFor(sorted, best.index, best.year);
}

/**
 * The season occurrence that starts next (strictly after `date`).
 */
export function nextInstance(
  seasons: SeasonLike[],
  date: Date = new Date(),
): SeasonInstance | null {
  const sorted = sortSeasons(seasons);
  if (sorted.length === 0) return null;

  const day = startOfDay(date);
  let best: { index: number; year: number; startTime: number } | null = null;

  for (let i = 0; i < sorted.length; i++) {
    for (const year of [day.getFullYear(), day.getFullYear() + 1]) {
      const start = seasonStartForYear(sorted[i], year);
      if (start.getTime() > day.getTime()) {
        if (!best || start.getTime() < best.startTime) {
          best = { index: i, year, startTime: start.getTime() };
        }
      }
    }
  }

  if (!best) return null;
  return instanceFor(sorted, best.index, best.year);
}

/**
 * The relevant instance for a specific season relative to `date`: its current
 * in-progress occurrence if that is the season running now, otherwise its next
 * upcoming occurrence.
 */
export function instanceForSeason(
  seasons: SeasonLike[],
  seasonId: string,
  date: Date = new Date(),
): SeasonInstance | null {
  const sorted = sortSeasons(seasons);
  const startIndex = sorted.findIndex((s) => s.id === seasonId);
  if (startIndex === -1) return null;

  const current = currentInstance(sorted, date);
  if (current && current.season.id === seasonId) return current;

  const next = nextInstance(sorted, date);
  if (next && next.season.id === seasonId) return next;

  const day = startOfDay(date);
  for (const year of [day.getFullYear(), day.getFullYear() + 1]) {
    const start = seasonStartForYear(sorted[startIndex], year);
    if (start.getTime() > day.getTime()) {
      return instanceFor(sorted, startIndex, year);
    }
  }
  return null;
}

export function formatSeasonDate(date: Date | null | undefined) {
  if (!date) return null;
  return date.toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Machine-days a request occupies. The coop rule is 1 hectare = 1 machine-day,
 * so a booking for N days consumes N machine-days from the member's
 * per-season pool (partial spans round UP, so 2.1 days books 3). Older
 * requests without a recorded duration fall back to the farm area, rounded up.
 * This is the single source of truth for how bookings deduct from capacity.
 */
export function hectareDayContribution(
  farmSize: number | null | undefined,
  durationDays: number | null | undefined,
) {
  const span = durationDays ?? farmSize;
  if (!span || span <= 0) return 0;
  return Math.ceil(span);
}

export const CAPACITY_COUNTING_STATUSES = [
  MachineStatus.QUEUED,
  MachineStatus.APPROVED,
  MachineStatus.IN_USE,
  MachineStatus.RETURN_PENDING,
  MachineStatus.OVERDUE,
];

export interface SeasonCapacityUsage {
  userId: string;
  seasonId: string;
  bookedHectareDays: number;
}

/**
 * Booked machine-days per member for the relevant instance of each season,
 * summed across ALL machines (a member draws from one season pool). Computed
 * live from machine requests so usage resets when a season changes.
 */
export async function computeCapacityUsage(
  seasons: SeasonLike[],
  now: Date = new Date(),
  db: Prisma.TransactionClient | PrismaClientUnion = client,
): Promise<SeasonCapacityUsage[]> {
  const sorted = sortSeasons(seasons);
  if (sorted.length === 0) return [];

  const instances = new Map<string, SeasonInstance>();
  for (const season of sorted) {
    const inst = instanceForSeason(sorted, season.id, now);
    if (inst) instances.set(season.id, inst);
  }

  const earliest = [...instances.values()].reduce(
    (min, inst) => (inst.start < min ? inst.start : min),
    instances.values().next().value?.start ?? now,
  );
  const latest = [...instances.values()].reduce(
    (max, inst) => (inst.end > max ? inst.end : max),
    earliest,
  );

  const requests = await db.machineRequest.findMany({
    where: {
      status: { in: CAPACITY_COUNTING_STATUSES },
      OR: [
        { startDate: { gte: earliest, lt: latest } },
        { startedAt: { gte: earliest, lt: latest } },
        { requestDate: { gte: earliest, lt: latest } },
      ],
    },
    select: {
      userId: true,
      startDate: true,
      startedAt: true,
      requestDate: true,
      farmSize: true,
      durationDays: true,
    },
  });

  const usageBySeason = new Map<string, Map<string, number>>();
  for (const season of sorted) {
    usageBySeason.set(season.id, new Map());
  }

  for (const req of requests) {
    const start = req.startDate ?? req.startedAt ?? req.requestDate;
    if (!start) continue;
    const contribution = hectareDayContribution(req.farmSize, req.durationDays);
    if (contribution <= 0) continue;

    for (const season of sorted) {
      const inst = instances.get(season.id);
      if (!inst) continue;
      if (start >= inst.start && start < inst.end) {
        const map = usageBySeason.get(season.id)!;
        map.set(req.userId, (map.get(req.userId) ?? 0) + contribution);
      }
    }
  }

  const result: SeasonCapacityUsage[] = [];
  for (const season of sorted) {
    for (const [userId, booked] of usageBySeason.get(season.id)!) {
      result.push({ userId, seasonId: season.id, bookedHectareDays: booked });
    }
  }
  return result;
}

/**
 * A member's booked machine-days in the season currently in progress, plus the
 * capacity state of that season. Returns null when no season is running.
 */
export async function getMemberCurrentSeasonCapacity(
  memberId: string,
  now: Date = new Date(),
  db: Prisma.TransactionClient | PrismaClientUnion = client,
) {
  const rows = await db.season.findMany({
    orderBy: [{ startMonth: "asc" }, { startDay: "asc" }],
  });
  if (rows.length === 0) return null;
  const seasons: SeasonLike[] = rows.map(({ id, name, startMonth, startDay }) => ({
    id,
    name,
    startMonth,
    startDay,
  }));

  const current = currentInstance(seasons, now);
  if (!current) return null;

  const usage = await computeCapacityUsage(seasons, now, db);
  const booked =
    usage.find((u) => u.seasonId === current.season.id && u.userId === memberId)
      ?.bookedHectareDays ?? 0;

  return {
    seasonId: current.season.id,
    seasonName: current.season.name,
    bookedHectareDays: booked,
  };
}

export interface MemberCapacity {
  id: string;
  name: string;
  farmHectares: number;
}

/**
 * Active members with their farm area. The member's per-season capacity limit
 * equals their farm area (1 hectare = 1 machine-day), shared across all
 * machines, resetting each season. Derived live — no per-member limit rows.
 */
export async function getCapacityMembers(
  tx: Prisma.TransactionClient | PrismaClientUnion = client,
): Promise<MemberCapacity[]> {
  const users = await tx.user.findMany({
    where: { role: Role.MEMBER, active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      applications: { select: { farmSize: true }, take: 1 },
    },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name ?? u.id,
    farmHectares: u.applications[0]?.farmSize ?? 0,
  }));
}

export interface SeasonOverview {
  seasons: SeasonLike[];
  current: SeasonInstance | null;
  next: SeasonInstance | null;
}

export async function getSeasonOverview(
  tx: Prisma.TransactionClient | PrismaClientUnion = client,
  now: Date = new Date(),
): Promise<SeasonOverview> {
  const rows = await tx.season.findMany({
    orderBy: [{ startMonth: "asc" }, { startDay: "asc" }],
  });
  const seasons: SeasonLike[] = rows.map(({ id, name, startMonth, startDay }) => ({
    id,
    name,
    startMonth,
    startDay,
  }));

  return {
    seasons: sortSeasons(seasons),
    current: currentInstance(seasons, now),
    next: nextInstance(seasons, now),
  };
}

type PrismaClientUnion = typeof client;