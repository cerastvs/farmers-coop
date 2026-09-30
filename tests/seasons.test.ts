import assert from "node:assert/strict";
import test from "node:test";

import "dotenv/config";

import {
  currentInstance,
  hectareDayContribution,
  instanceForSeason,
  isValidMonthDay,
  nextInstance,
  bookedInInstance,
  computeCapacityUsage,
  periodFor,
  seasonContainingBooking,
  seasonCapacityLimit,
  sortSeasons,
} from "../lib/services/seasons";

const seasons = [
  { id: "wet", name: "Wet Season", startMonth: 5, startDay: 1 },
  { id: "dry", name: "Dry Season", startMonth: 11, startDay: 1 },
];

const monthDay = (d: Date) => ({
  m: d.getMonth() + 1,
  d: d.getDate(),
  y: d.getFullYear(),
});

test("seasons sort by month then day", () => {
  const sorted = sortSeasons([
    { id: "b", name: "B", startMonth: 6, startDay: 1 },
    { id: "a", name: "A", startMonth: 4, startDay: 15 },
    { id: "c", name: "C", startMonth: 12, startDay: 31 },
  ]);
  assert.deepEqual(
    sorted.map((s) => s.id),
    ["a", "b", "c"],
  );
});

test("a season runs until the next season starts (same year)", () => {
  const { end, next, nextStart } = periodFor(seasons, 0, 2026); // wet
  assert.equal(next.id, "dry");
  assert.deepEqual(monthDay(end), { m: 11, d: 1, y: 2026 });
  assert.equal(end.getTime(), nextStart.getTime());
});

test("a season's period wraps into the next year after the last season", () => {
  const { end, next, nextStart } = periodFor(seasons, 1, 2026); // dry, last
  assert.equal(next.id, "wet");
  const e = monthDay(end);
  const s = monthDay(nextStart);
  assert.deepEqual(e, { m: 5, d: 1, y: 2027 });
  assert.deepEqual(s, { m: 5, d: 1, y: 2027 });
  assert.equal(end.getTime(), nextStart.getTime());
});

test("current season is wet from May 1 and dry from Nov 1", () => {
  const mid = currentInstance(seasons, new Date(2026, 5, 15));
  assert.equal(mid?.season.id, "wet");
  assert.equal(mid?.year, 2026);

  const late = currentInstance(seasons, new Date(2026, 11, 15));
  assert.equal(late?.season.id, "dry");
  assert.equal(late?.year, 2026);
  assert.equal(late?.end.getFullYear(), 2027); // ends at next Wet Season
});

test("early in the year the current season is the previous season wrapped from last year", () => {
  const cur = currentInstance(seasons, new Date(2026, 3, 15));
  assert.equal(cur?.season.id, "dry");
  assert.equal(cur?.year, 2025);
  assert.deepEqual(monthDay(cur!.start), { m: 11, d: 1, y: 2025 });
  assert.deepEqual(monthDay(cur!.end), { m: 5, d: 1, y: 2026 });
});

test("next season is dry after wet, and wet after dry", () => {
  const n1 = nextInstance(seasons, new Date(2026, 5, 15));
  assert.equal(n1?.season.id, "dry");
  assert.deepEqual(monthDay(n1!.start), { m: 11, d: 1, y: 2026 });

  const n2 = nextInstance(seasons, new Date(2026, 11, 15));
  assert.equal(n2?.season.id, "wet");
  assert.deepEqual(monthDay(n2!.start), { m: 5, d: 1, y: 2027 });
});

test("next season in early year is the wet season later that same year", () => {
  const n = nextInstance(seasons, new Date(2026, 3, 15));
  assert.equal(n?.season.id, "wet");
  assert.deepEqual(monthDay(n!.start), { m: 5, d: 1, y: 2026 });
});

test("a single season still covers the entire year and repeats annually", () => {
  const one = [{ id: "solo", name: "Rainy", startMonth: 1, startDay: 1 }];
  const cur = currentInstance(one, new Date(2026, 6, 1));
  assert.equal(cur?.season.id, "solo");
  assert.equal(cur?.year, 2026);
  assert.equal(cur?.end.getFullYear(), 2027);

  const next = nextInstance(one, new Date(2026, 6, 1));
  assert.equal(next?.season.id, "solo");
  assert.deepEqual(monthDay(next!.start), { m: 1, d: 1, y: 2027 });
});

test("no seasons means no current or next instance", () => {
  assert.equal(currentInstance([]), null);
  assert.equal(nextInstance([]), null);
});

test("instanceForSeason returns in-progress occurrence for the current season", () => {
  const inst = instanceForSeason(seasons, "wet", new Date(2026, 5, 15));
  assert.equal(inst?.season.id, "wet");
  assert.equal(inst?.year, 2026);
});

test("instanceForSeason returns the next occurrence for an upcoming season", () => {
  const inst = instanceForSeason(seasons, "dry", new Date(2026, 5, 15));
  assert.equal(inst?.season.id, "dry");
  assert.deepEqual(monthDay(inst!.start), { m: 11, d: 1, y: 2026 });
});

test("season start dates reject invalid month/day pairs", () => {
  assert.equal(isValidMonthDay(2, 29), false);
  assert.equal(isValidMonthDay(4, 31), false);
  assert.equal(isValidMonthDay(13, 1), false);
  assert.equal(isValidMonthDay(0, 1), false);
  assert.equal(isValidMonthDay(6, 0), false);
  assert.equal(isValidMonthDay(2, 28), true);
  assert.equal(isValidMonthDay(11, 1), true);
  assert.equal(isValidMonthDay(12, 31), true);
});

test("machine-days consumed = the days booked, rounded up (1 day = 1 ha of farm budget)", () => {
  assert.equal(hectareDayContribution(5, 3), 3);
  assert.equal(hectareDayContribution(5, 3), 3);
  assert.equal(hectareDayContribution(5, 2.1), 3);
  assert.equal(hectareDayContribution(5, 5), 5);
  assert.equal(hectareDayContribution(5, 0), 0);
  assert.equal(hectareDayContribution(null, null), 0);
  // Legacy requests without a recorded duration fall back to the farm area (rounded up).
  assert.equal(hectareDayContribution(2.1, null), 3);
  assert.equal(hectareDayContribution(2, null), 2);
});

test("season budget = farm area rounded UP, so an excess hectare is a whole day", () => {
  // The reported bug: 5.1 ha must buy 6 days, not 5.
  assert.equal(seasonCapacityLimit(5.1), 6);
  assert.equal(seasonCapacityLimit(5), 5);
  assert.equal(seasonCapacityLimit(2.1), 3);
  assert.equal(seasonCapacityLimit(0.4), 1);
  assert.equal(seasonCapacityLimit(1), 1);
  // A missing or zero area floors to one day rather than locking the member
  // out entirely, keeping the request-time cap and the approval-time cap in
  // agreement.
  assert.equal(seasonCapacityLimit(0), 1);
  assert.equal(seasonCapacityLimit(null), 1);
  assert.equal(seasonCapacityLimit(undefined), 1);
  assert.equal(seasonCapacityLimit(-3), 1);
});

test("a booking that exactly fills the rounded budget is allowed", () => {
  // 5.1 ha -> 6 day budget: 4 booked plus a 2-day request fits exactly, 3 does not.
  const limit = seasonCapacityLimit(5.1);
  assert.equal(4 + 2 > limit, false);
  assert.equal(4 + 3 > limit, true);
  // The regression from the report: a 2 ha member with 1 day already in use
  // has 1 day left, so a 1-day request must be approvable.
  assert.equal(1 + 1 > seasonCapacityLimit(2), false);
  // A 3rd day against that same 2-day budget is still correctly refused.
  assert.equal(2 + 1 > seasonCapacityLimit(2), true);
});
/**
 * A booking must sit inside a single season.
 *
 * The capacity pool resets each season, so a booking spanning two seasons would
 * have to be charged against two different budgets — and which one it counted
 * against depended on the day the approval happened to be processed, rather
 * than on anything the member or the office decided.
 */
test("a booking inside one season is accepted", () => {
  const start = new Date(2026, 5, 1); // 1 Jun 2026, inside the wet season
  const end = new Date(2026, 9, 30); // 30 Oct 2026

  const instance = seasonContainingBooking(seasons, start, end);

  assert.ok(instance);
  assert.equal(instance.season.id, "wet");
});

test("a booking that crosses into the next season is rejected", () => {
  // Starts in the wet season, ends in the dry one.
  const start = new Date(2026, 9, 15);
  const end = new Date(2026, 10, 15);

  assert.equal(seasonContainingBooking(seasons, start, end), null);
});

test("a booking ending exactly on the next season's start is rejected", () => {
  // The dry season begins 1 Nov; a booking ending at that instant has left
  // the wet season, even though the end date looks like "the last day of October".
  const start = new Date(2026, 9, 20);
  const end = new Date(2026, 10, 1);

  assert.equal(seasonContainingBooking(seasons, start, end), null);
});

test("a booking ending on the final day of the season is still inside it", () => {
  // 31 Oct is the last day of the wet season and must not be treated as
  // spilling into the dry one.
  const start = new Date(2026, 9, 30);
  const end = new Date(2026, 9, 31);

  const instance = seasonContainingBooking(seasons, start, end);

  assert.ok(instance);
  assert.equal(instance.season.id, "wet");
});

test("a single-day booking is inside its season", () => {
  const day = new Date(2026, 5, 15);

  const instance = seasonContainingBooking(seasons, day, day);

  assert.ok(instance);
  assert.equal(instance.season.id, "wet");
});

test("with no seasons configured the booking cannot be placed in a season", () => {
  // There is no budget to charge the booking against, so it cannot be
  // validated. Returning null makes the caller reject rather than silently
  // approve an uncounted booking.
  assert.equal(
    seasonContainingBooking([], new Date(2026, 5, 1), new Date(2026, 5, 5)),
    null,
  );
});

test("committed machine-days are read per member and per season", () => {
  const usage = [
    { seasonId: "wet", userId: "m1", bookedHectareDays: 4 },
    { seasonId: "wet", userId: "m2", bookedHectareDays: 2 },
    { seasonId: "dry", userId: "m1", bookedHectareDays: 7 },
  ];

  assert.equal(bookedInInstance(usage, "wet", "m1"), 4);
  assert.equal(bookedInInstance(usage, "dry", "m1"), 7);
  // A member with nothing booked in a season is zero, not an error.
  assert.equal(bookedInInstance(usage, "wet", "m3"), 0);
});

test("the request under approval is excluded from its own season total", async () => {
  // Regression: a QUEUED request is already inside the season total, so
  // re-adding its days at approval charged the member twice for one booking
  // and refused a 1-day request that fit.
  const seen: Record<string, unknown>[] = [];
  const db = {
    machineRequest: {
      findMany: async (args: Record<string, unknown>) => {
        seen.push(args.where as Record<string, unknown>);
        return [];
      },
    },
  };

  await computeCapacityUsage(seasons, new Date(2026, 5, 15), db as never, "req-1");
  assert.deepEqual(seen[0].id, { not: "req-1" });

  // With nothing to exclude, the filter is absent rather than matching nothing,
  // so ordinary callers keep counting every request.
  await computeCapacityUsage(seasons, new Date(2026, 5, 15), db as never);
  assert.equal("id" in seen[1], false);
});
