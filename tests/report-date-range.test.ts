import assert from "node:assert/strict";
import test from "node:test";

import {
  asOfPrisma,
  dateRangePrisma,
  isInReportDateRange,
  reportDateBoundary,
} from "../lib/report-date-range";

test("date-only report filters cover the whole selected local day", () => {
  const filters = { from: "2026-09-13", to: "2026-09-13" };
  const start = reportDateBoundary(filters.from, "start");
  const end = reportDateBoundary(filters.to, "end");

  assert.ok(start);
  assert.ok(end);
  assert.equal(start.getFullYear(), 2026);
  assert.equal(start.getMonth(), 8);
  assert.equal(start.getDate(), 13);
  assert.equal(start.getHours(), 0);
  assert.equal(start.getMinutes(), 0);
  assert.equal(end.getFullYear(), 2026);
  assert.equal(end.getMonth(), 8);
  assert.equal(end.getDate(), 13);
  assert.equal(end.getHours(), 23);
  assert.equal(end.getMinutes(), 59);
  assert.equal(end.getSeconds(), 59);
  assert.equal(end.getMilliseconds(), 999);
});

test("same-day report filters reject records from earlier dates", () => {
  const filters = { from: "2026-09-13", to: "2026-09-13" };

  assert.equal(isInReportDateRange(new Date(2026, 8, 9, 12), filters), false);
  assert.equal(isInReportDateRange(new Date(2026, 8, 13, 0), filters), true);
  assert.equal(isInReportDateRange(new Date(2026, 8, 13, 23, 59), filters), true);
  assert.equal(isInReportDateRange(new Date(2026, 8, 14, 0), filters), false);
});

test("Prisma report date filters use normalized boundaries", () => {
  const range = dateRangePrisma({ from: "2026-09-13", to: "2026-09-13" });

  assert.ok(range.gte instanceof Date);
  assert.ok(range.lte instanceof Date);
  assert.equal(range.gte.getHours(), 0);
  assert.equal(range.lte.getHours(), 23);
});

test("single-date as-of filter caps at end of the selected day", () => {
  const cutoff = asOfPrisma({ from: "2026-09-15", to: "2026-09-15" });

  assert.ok(cutoff.lte instanceof Date);
  assert.equal(cutoff.gte, undefined);
  assert.equal(cutoff.lte.getFullYear(), 2026);
  assert.equal(cutoff.lte.getMonth(), 8);
  assert.equal(cutoff.lte.getDate(), 15);
  assert.equal(cutoff.lte.getHours(), 23);
  assert.equal(cutoff.lte.getMinutes(), 59);
  assert.equal(cutoff.lte.getSeconds(), 59);
});

test("as-of filter keeps users registered before the selected day", () => {
  const cutoff = asOfPrisma({ to: "2026-09-15" });

  assert.ok(cutoff.lte instanceof Date);
  assert.ok(new Date(2026, 8, 10, 12) <= cutoff.lte);
  assert.ok(new Date(2026, 8, 16, 0) > cutoff.lte);
});

test("as-of filter falls back to the from date when to is missing", () => {
  const cutoff = asOfPrisma({ from: "2026-09-15" });

  assert.ok(cutoff.lte instanceof Date);
  assert.equal(cutoff.lte.getDate(), 15);
});

test("as-of filter is empty when no date is given", () => {
  assert.deepEqual(asOfPrisma({}), {});
});
