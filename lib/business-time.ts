/**
 * Business-timezone helpers.
 *
 * The cooperative operates on Philippine Time. Report periods, "days overdue",
 * and end-of-day cutoffs are all defined in that zone, never in the server's
 * local zone.
 *
 * This matters because the server's local zone is not guaranteed to match the
 * business zone. A container that defaults to UTC would silently shift every
 * daily report by 8 hours — moving transactions into the wrong day, the wrong
 * month, and at year end the wrong reporting year. Resolving the zone
 * explicitly makes the result independent of how the host is configured.
 *
 * Storage stays UTC: `Date` values are absolute instants and Prisma columns are
 * `timestamp without time zone` holding UTC wall-clock. These helpers only
 * decide which instant a business calendar day maps to.
 */

export const BUSINESS_TIME_ZONE = "Asia/Manila";

const partsFormatter = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string) {
  let formatter = partsFormatter.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatter.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * Offset of `timeZone` from UTC, in milliseconds, at the given instant.
 * Positive east of Greenwich (Asia/Manila is +08:00).
 */
export function zoneOffsetMs(
  instant: Date,
  timeZone: string = BUSINESS_TIME_ZONE,
): number {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  // Intl renders midnight as hour 24 in some ICU versions; normalise to 0.
  const hour = read("hour") % 24;
  const asUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    hour,
    read("minute"),
    read("second"),
  );
  // Drop sub-second precision from the instant so the comparison is exact.
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * The instant corresponding to a business-timezone wall-clock time.
 *
 * Two passes: the wall-clock is treated as UTC to locate a candidate instant,
 * the zone offset at that candidate is measured, and the offset is subtracted.
 * One extra pass settles zones whose offset changes across a DST boundary.
 */
export function zonedTimeToDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
  timeZone: string = BUSINESS_TIME_ZONE,
): Date {
  const wallClockAsUtc = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    millisecond,
  );
  const firstGuess = wallClockAsUtc - zoneOffsetMs(new Date(wallClockAsUtc), timeZone);
  const refined = wallClockAsUtc - zoneOffsetMs(new Date(firstGuess), timeZone);
  return new Date(refined);
}

/**
 * Start of the given business-timezone calendar day, as an absolute instant.
 */
export function startOfBusinessDay(
  date: Date,
  timeZone: string = BUSINESS_TIME_ZONE,
): Date {
  const parts = formatterFor(timeZone).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return zonedTimeToDate(
    read("year"),
    read("month"),
    read("day"),
    0,
    0,
    0,
    0,
    timeZone,
  );
}

/**
 * Exclusive end of the given business-timezone calendar day: the start of the
 * following day. Preferred over an inclusive 23:59:59.999 upper bound, which
 * leaves a gap at sub-millisecond precision.
 */
export function endOfBusinessDay(
  date: Date,
  timeZone: string = BUSINESS_TIME_ZONE,
): Date {
  const start = startOfBusinessDay(date, timeZone);
  const parts = formatterFor(timeZone).formatToParts(start);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return zonedTimeToDate(
    read("year"),
    read("month"),
    read("day") + 1,
    0,
    0,
    0,
    0,
    timeZone,
  );
}

/**
 * Whole calendar days from `from` to `to`; positive when `to` is later.
 *
 * Despite the older name, weekends are deliberately NOT skipped. Lateness is
 * counted in real elapsed days: a machine due Friday and returned on the
 * following Monday is three days late, and reporting it as one day would
 * understate the delinquency. Only the *zone* in which the days are counted is
 * business-specific.
 */
export function businessDaysBetween(
  from: Date,
  to: Date,
  timeZone: string = BUSINESS_TIME_ZONE,
): number {
  const ms =
    startOfBusinessDay(to, timeZone).getTime() -
    startOfBusinessDay(from, timeZone).getTime();
  return Math.floor(ms / 86_400_000);
}
