import assert from "node:assert/strict";
import test from "node:test";

import {
  asOfPrisma,
  dateRangePrisma,
  isInReportDateRange,
  liveAsOfStatusFilter,
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

test("live as-of filter keeps only still-live statuses and caps at the end of the selected day", () => {
  const filter = liveAsOfStatusFilter(
    { from: "2026-09-13", to: "2026-09-13" },
    ["PENDING", "ACTIVE", "OVERDUE"],
  );

  assert.deepEqual(filter.status, { in: ["PENDING", "ACTIVE", "OVERDUE"] });
  assert.ok(filter.createdAt);
  const cutoff = filter.createdAt.lte as Date;
  assert.equal(cutoff.getFullYear(), 2026);
  assert.equal(cutoff.getMonth(), 8);
  assert.equal(cutoff.getDate(), 13);
  assert.equal(cutoff.getHours(), 23);
  assert.equal(cutoff.getMinutes(), 59);
});

test("live as-of filter keeps records created before the selected day", () => {
  const filter = liveAsOfStatusFilter(
    { to: "2026-09-15" },
    ["PENDING", "ACTIVE"],
  );

  assert.ok(filter.createdAt);
  const cutoff = filter.createdAt.lte as Date;
  assert.ok(new Date(2026, 8, 12, 9) <= cutoff);
  assert.ok(new Date(2026, 8, 16, 0) > cutoff);
});

test("live as-of filter drops the date constraint when no date is given", () => {
  const filter = liveAsOfStatusFilter({}, ["PENDING"]);

  assert.deepEqual(filter.status, { in: ["PENDING"] });
  assert.equal(filter.createdAt, undefined);
});
