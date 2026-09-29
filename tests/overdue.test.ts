import assert from "node:assert/strict";
import test from "node:test";

import "dotenv/config";

import { LoanStatus, MachineStatus } from "../app/generated/prisma";
import {
  daysBetween,
  isDateOverdue,
  isMachineRequestOverdueAsOf,
  OPEN_LOAN_STATUSES,
  requiredDurationDays,
  UNRETURNED_MACHINE_STATUSES,
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

test("machine request is overdue only as of days past the end date and unreturned", () => {
  const asOf = new Date(2026, 8, 15, 12);
  const endDate = new Date(2026, 8, 12, 9);

  assert.equal(
    isMachineRequestOverdueAsOf(endDate, null, asOf),
    true,
    "past end date and never returned",
  );
  assert.equal(
    isMachineRequestOverdueAsOf(endDate, new Date(2026, 8, 15, 8), asOf),
    false,
    "returned earlier on the report day",
  );
  assert.equal(
    isMachineRequestOverdueAsOf(endDate, new Date(2026, 8, 16, 8), asOf),
    true,
    "returned after the report day",
  );
  assert.equal(
    isMachineRequestOverdueAsOf(new Date(2026, 8, 15, 8), null, asOf),
    false,
    "same-day end date is not overdue",
  );
  assert.equal(
    isMachineRequestOverdueAsOf(new Date(2026, 8, 20), null, asOf),
    false,
    "future end date is not overdue",
  );
  assert.equal(isMachineRequestOverdueAsOf(null, null, asOf), false);
});

/**
 * An obligation already flagged OVERDUE must stay visible.
 *
 * The overdue scan used to select only ACTIVE loans and IN_USE machines —
 * the states *before* the transition. So on the first run an obligation was
 * found and marked OVERDUE, and on every run after that it had already left
 * the selection and vanished from the working list. Officers saw the problem
 * exactly once, and the persistent "still overdue" figure read as zero.
 */
test("already-overdue loans stay in the working set", () => {
  assert.ok(OPEN_LOAN_STATUSES.includes(LoanStatus.ACTIVE));
  assert.ok(OPEN_LOAN_STATUSES.includes(LoanStatus.OVERDUE));
  // Settled loans are genuinely closed and must drop out.
  const openLoans: readonly LoanStatus[] = OPEN_LOAN_STATUSES;
  assert.ok(!openLoans.includes(LoanStatus.PAID));
  assert.ok(!openLoans.includes(LoanStatus.REJECTED));
});

test("already-overdue machines stay in the working set", () => {
  assert.ok(UNRETURNED_MACHINE_STATUSES.includes(MachineStatus.IN_USE));
  assert.ok(UNRETURNED_MACHINE_STATUSES.includes(MachineStatus.OVERDUE));
  // Returned and rejected are not unreturned.
  const unreturned: readonly MachineStatus[] = UNRETURNED_MACHINE_STATUSES;
  assert.ok(!unreturned.includes(MachineStatus.RETURNED));
  assert.ok(!unreturned.includes(MachineStatus.REJECTED));
});

test("an obligation due today is not yet overdue", () => {
  // Marking a loan overdue on its due date would penalise a borrower who still
  // has the full day to pay.
  const now = new Date(2026, 8, 15, 10, 0);
  const dueToday = new Date(2026, 8, 15, 0, 0);

  assert.equal(isDateOverdue(dueToday, now), false);
  assert.equal(isDateOverdue(new Date(2026, 8, 14, 23, 59), now), true);
});
