import assert from "node:assert/strict";
import test from "node:test";

import {
  BUSINESS_TIME_ZONE,
  businessDaysBetween,
  endOfBusinessDay,
  startOfBusinessDay,
  zoneOffsetMs,
  zonedTimeToDate,
} from "../lib/business-time";
import { reportDateBoundary } from "../lib/report-date-range";

/**
 * The cooperative operates on Philippine Time. These tests pin the zone
 * conversion so a host-timezone change (a UTC container) cannot silently move a
 * report boundary or an overdue count by a day.
 *
 * Asia/Manila is UTC+8 with no DST, so Manila midnight on 2026-03-15 is
 * 2026-03-14T16:00:00Z.
 */
const MANILA_MIDNIGHT_15 = Date.UTC(2026, 2, 14, 16, 0, 0, 0);
const MANILA_MIDNIGHT_16 = Date.UTC(2026, 2, 15, 16, 0, 0, 0);

test("the business zone is Asia/Manila at a fixed +08:00 offset", () => {
  assert.equal(BUSINESS_TIME_ZONE, "Asia/Manila");
  assert.equal(zoneOffsetMs(new Date(MANILA_MIDNIGHT_15)), 8 * 3600_000);
});

test("startOfBusinessDay returns Manila midnight, not host midnight", () => {
  // 13:00 Manila on the 15th.
  const start = startOfBusinessDay(new Date(MANILA_MIDNIGHT_15 + 13 * 3600_000));

  assert.equal(start.getTime(), MANILA_MIDNIGHT_15);
});

test("an instant just before Manila midnight stays on the previous day", () => {
  // 23:59:59 Manila on the 15th.
  const justBefore = MANILA_MIDNIGHT_16 - 1000;

  assert.equal(startOfBusinessDay(new Date(justBefore)).getTime(), MANILA_MIDNIGHT_15);
});

test("an instant at Manila midnight rolls to the new day", () => {
  assert.equal(
    startOfBusinessDay(new Date(MANILA_MIDNIGHT_16)).getTime(),
    MANILA_MIDNIGHT_16,
  );
});

test("endOfBusinessDay is exclusive: the start of the following day", () => {
  assert.equal(
    endOfBusinessDay(new Date(MANILA_MIDNIGHT_15)).getTime(),
    MANILA_MIDNIGHT_16,
  );
});

test("a date-only report filter resolves to Manila midnight, not host midnight", () => {
  // This is the H1 regression: a UTC deployment used to build this boundary
  // with `new Date(y, m, d)`, landing 8 hours early and moving same-day
  // transactions into the previous day.
  assert.equal(
    reportDateBoundary("2026-03-15", "start")?.getTime(),
    MANILA_MIDNIGHT_15,
  );
  // The end boundary is the last instant of the Manila day.
  assert.equal(
    reportDateBoundary("2026-03-15", "end")?.getTime(),
    MANILA_MIDNIGHT_16 - 1,
  );
  assert.equal(reportDateBoundary(undefined, "start"), null);
});

test("a report filter with an explicit offset is used as given", () => {
  const absolute = "2026-03-15T02:00:00.000Z";

  assert.equal(reportDateBoundary(absolute, "start")?.getTime(), Date.parse(absolute));
  assert.equal(reportDateBoundary("not-a-date", "start"), null);
});

test("lateness counts real calendar days across a weekend", () => {
  // Friday 2026-03-13 -> Monday 2026-03-16 is three days late, not one.
  // Skipping weekends would understate the delinquency.
  const friday = new Date(Date.UTC(2026, 2, 13, 4, 0, 0));
  const monday = new Date(Date.UTC(2026, 2, 16, 4, 0, 0));

  assert.equal(businessDaysBetween(friday, monday), 3);
});

test("an obligation due today is not yet late, but is the next day", () => {
  const due = new Date(MANILA_MIDNIGHT_15 + 12 * 3600_000); // 12:00 Manila, the 15th

  assert.equal(
    businessDaysBetween(due, new Date(MANILA_MIDNIGHT_15 + 20 * 3600_000)),
    0,
  );
  assert.equal(
    businessDaysBetween(due, new Date(MANILA_MIDNIGHT_16 + 12 * 3600_000)),
    1,
  );
});

test("days elapsed are counted in Manila days, not UTC days", () => {
  // 23:30 Manila on the 15th is 15:30 UTC on the 15th. Counting in UTC would
  // give the same answer here, so use an instant that straddles the boundary.
  const lateManila15 = new Date(MANILA_MIDNIGHT_15 + 23.5 * 3600_000);
  const earlyManila16 = new Date(MANILA_MIDNIGHT_16 + 0.5 * 3600_000);

  // One Manila day apart, though less than an hour apart in absolute time.
  assert.equal(businessDaysBetween(lateManila15, earlyManila16), 1);
});

test("zonedTimeToDate round-trips a Manila wall clock", () => {
  const date = zonedTimeToDate(2026, 3, 15, 0, 0, 0, 0);

  assert.equal(date.getTime(), MANILA_MIDNIGHT_15);
  // Idempotent: resolving the start of that day changes nothing.
  assert.equal(startOfBusinessDay(date).getTime(), date.getTime());
});
