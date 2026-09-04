import assert from "node:assert/strict";
import test from "node:test";

import "dotenv/config";

import {
  daysBetween,
  isDateOverdue,
  requiredDurationDays,
} from "../lib/services/overdue";

test("machine duration ceiling is one day per hectare, minimum one", () => {
  assert.equal(requiredDurationDays(0), 1);
  assert.equal(requiredDurationDays(-2), 1);
  assert.equal(requiredDurationDays(1), 1);
  assert.equal(requiredDurationDays(1.5), 2);
  assert.equal(requiredDurationDays(3), 3);
  assert.equal(requiredDurationDays(3.2), 4);
});

test("daysBetween counts whole days across month boundaries", () => {
  assert.equal(daysBetween(new Date(2026, 0, 1), new Date(2026, 0, 1)), 0);
  assert.equal(daysBetween(new Date(2026, 0, 1), new Date(2026, 0, 15)), 14);
  assert.equal(
    daysBetween(new Date(2026, 0, 31), new Date(2026, 1, 28)),
    28,
  );
  assert.equal(daysBetween(new Date(2026, 0, 1), new Date(2026, 2, 1)), 59);
});

test("isDateOverdue only flags a fully-passed due date", () => {
  const now = new Date(2026, 2, 15, 9, 30);
  assert.equal(isDateOverdue(new Date(2026, 2, 14, 23, 0), now), true);
  assert.equal(isDateOverdue(new Date(2026, 2, 15, 0, 0), now), false);
  assert.equal(isDateOverdue(new Date(2026, 2, 16, 0, 0), now), false);
});
