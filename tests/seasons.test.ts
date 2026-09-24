import assert from "node:assert/strict";
import test from "node:test";

import "dotenv/config";

import {
  currentInstance,
  hectareDayContribution,
  instanceForSeason,
  isValidMonthDay,
  nextInstance,
  periodFor,
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

test("hectare-days usage is farm size times the booked days", () => {
  assert.equal(hectareDayContribution(3, 4), 12);
  assert.equal(hectareDayContribution(2.5, 3), 7.5);
  assert.equal(hectareDayContribution(3, null), 9); // 3 ha => 3 days by the 1 ha/day rule
  assert.equal(hectareDayContribution(0, 5), 0);
  assert.equal(hectareDayContribution(null, 5), 0);
});