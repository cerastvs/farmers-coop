import type { Prisma } from "@/app/generated/prisma";

export type ReportDateFilters = {
  from?: string;
  to?: string;
};

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function reportDateBoundary(
  value: string | undefined,
  boundary: "start" | "end",
): Date | null {
  if (!value) return null;

  const dateOnly = DATE_ONLY_PATTERN.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return boundary === "start"
      ? new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0)
      : new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateRangePrisma(
  filters: ReportDateFilters,
): Prisma.DateTimeFilter {
  const range: Prisma.DateTimeFilter = {};
  const from = reportDateBoundary(filters.from, "start");
  const to = reportDateBoundary(filters.to, "end");

  if (from) range.gte = from;
  if (to) range.lte = to;

  return range;
}

// Point-in-time cutoff for roster-style reports (e.g. member records). Records
// are captured "as of" the end of the selected day, so a single-date report
// still includes everyone registered before or on that date.
export function asOfPrisma(
  filters: ReportDateFilters,
): Prisma.DateTimeFilter {
  const cutoff = reportDateBoundary(filters.to ?? filters.from, "end");
  return cutoff ? { lte: cutoff } : {};
}

// "As of" filter for obligation-style records (pending payments, outstanding
// loans). Such records represent a continuing balance rather than one-off
// activity, so they must remain in a report generated for a later date as long
// as they are still live (unsettled / cancelled). Callers OR this together with
// normal period-activity date range filters.
export function liveAsOfStatusFilter<T extends string>(
  filters: ReportDateFilters,
  liveStatuses: readonly T[],
) {
  const cutoff = asOfPrisma(filters);
  return {
    status: { in: [...liveStatuses] as T[] },
    ...(cutoff && "lte" in cutoff ? { createdAt: cutoff } : {}),
  };
}

export function isInReportDateRange(
  date: Date | null | undefined,
  filters: ReportDateFilters,
) {
  if (!date) return true;

  const from = reportDateBoundary(filters.from, "start");
  if (from && date < from) return false;

  const to = reportDateBoundary(filters.to, "end");
  if (to && date > to) return false;

  return true;
}
