import assert from "node:assert/strict";
import test from "node:test";

import "dotenv/config";

import { MachineStatus } from "../app/generated/prisma";
import {
  hasPendingMachineAction,
  isMachineRequestOverdue,
  isReturnableMachineStatus,
  loanOverdueDays,
  machineActiveOverdueDays,
  machineRequestOverdueDays,
  machineHasPendingAction,
  worstOverdueRequest,
} from "../app/lib/client-overdue";
import { UNRETURNED_MACHINE_STATUSES } from "../lib/services/overdue";

/**
 * The client helper cannot import the server's Prisma-backed status list
 * without dragging the query engine into the browser bundle, so it keeps a
 * plain-string copy. These tests are the thing that stops the copy rotting:
 * if the server's definition changes, this fails rather than the badge
 * quietly disagreeing with the officer list.
 */
test("client copy of the returnable-status list matches the server's", () => {
  const server = [...UNRETURNED_MACHINE_STATUSES].sort();
  const client = [MachineStatus.IN_USE, MachineStatus.OVERDUE].sort();
  assert.deepEqual(client, server);
  for (const status of server) {
    assert.equal(isReturnableMachineStatus(status), true, `${status} should be returnable`);
  }
});

test("a request that was never picked up cannot be overdue", () => {
  // The reported bug: a QUEUED request was counted as days overdue even
  // though the member never had the machine. Its end date had passed, so the
  // old status-blind check reported it late.
  const due = new Date("2026-09-26T00:00:00.000Z");
  const now = new Date("2026-09-30T03:00:00.000Z");

  assert.equal(machineRequestOverdueDays(MachineStatus.QUEUED, due.toISOString(), null, now), 0);
  assert.equal(isMachineRequestOverdue(MachineStatus.QUEUED, due.toISOString(), null, now), false);

  // APPROVED is reserved, not held — same answer.
  assert.equal(isMachineRequestOverdue(MachineStatus.APPROVED, due.toISOString(), null, now), false);
  // RETURNED and REJECTED are closed.
  assert.equal(isMachineRequestOverdue(MachineStatus.RETURNED, due.toISOString(), null, now), false);
  assert.equal(isMachineRequestOverdue(MachineStatus.REJECTED, due.toISOString(), null, now), false);

  // But the member really is holding this one, so it is late.
  assert.equal(isMachineRequestOverdue(MachineStatus.IN_USE, due.toISOString(), null, now), true);
});

test("a booking due today is not overdue", () => {
  const now = new Date("2026-09-30T03:00:00.000Z");
  const dueToday = new Date("2026-09-30T00:00:00.000Z");
  assert.equal(machineRequestOverdueDays(MachineStatus.IN_USE, dueToday.toISOString(), null, now), 0);
});

test("a returned booking is never overdue", () => {
  const now = new Date("2026-09-30T03:00:00.000Z");
  const due = new Date("2026-09-20T00:00:00.000Z");
  assert.equal(machineRequestOverdueDays(MachineStatus.IN_USE, due.toISOString(), "2026-09-21T00:00:00.000Z", now), 0);
});

test("overdue days are counted on the business calendar, not the host's", () => {
  // A booking that ended at UTC midnight on the 30th, checked at 03:00 UTC on
  // the 30th. In Manila that is 08:00 on the 30th — the same day, so not yet
  // late. A host-local calculation running in UTC would call this 0 days
  // overdue too, but a host in a zone behind Manila would have called it 1.
  const now = new Date("2026-09-30T03:00:00.000Z");
  assert.equal(machineRequestOverdueDays(MachineStatus.IN_USE, "2026-09-30T00:00:00.000Z", null, now), 0);

  // One full business day later it is late by exactly one.
  const tomorrow = new Date("2026-10-01T03:00:00.000Z");
  assert.equal(machineRequestOverdueDays(MachineStatus.IN_USE, "2026-09-30T00:00:00.000Z", null, tomorrow), 1);
});

test("a machine card reports the latest late booking and whose it is", () => {
  const now = new Date("2026-09-30T03:00:00.000Z");
  const requests = [
    // Queued and past due: ignored now that status is respected.
    { id: "q", status: MachineStatus.QUEUED, endDate: "2026-09-26T00:00:00.000Z", returnedAt: null, member: { name: "Member1" } },
    { id: "a", status: MachineStatus.IN_USE, endDate: "2026-09-10T00:00:00.000Z", returnedAt: null, member: { name: "Lee" } },
    { id: "b", status: MachineStatus.IN_USE, endDate: "2026-09-30T00:00:00.000Z", returnedAt: null, member: { name: "LieuRikawa" } },
  ];

  const worst = worstOverdueRequest(requests, now);
  assert.equal(worst?.id, "a");
  assert.equal(worst?.member.name, "Lee");
  assert.equal(worst?.overdueDays, 20);
  assert.equal(machineActiveOverdueDays(requests, now), 20);
});

test("a machine with nothing genuinely late reports zero", () => {
  const now = new Date("2026-09-30T03:00:00.000Z");
  const requests = [
    { id: "b", status: MachineStatus.IN_USE, endDate: "2026-09-30T00:00:00.000Z", returnedAt: null },
    { id: "q", status: MachineStatus.QUEUED, endDate: "2026-09-26T00:00:00.000Z", returnedAt: null },
  ];
  assert.equal(machineActiveOverdueDays(requests, now), 0);
  assert.equal(worstOverdueRequest(requests, now), null);
  assert.equal(machineActiveOverdueDays(undefined, now), 0);
});

test("pending-machine filters include overdue in-use requests", () => {
  const now = new Date("2026-10-05T03:00:00.000Z");
  const overdueInUse = {
    status: MachineStatus.IN_USE,
    endDate: "2026-09-29T00:00:00.000Z",
    returnedAt: null,
  };
  const futureInUse = {
    status: MachineStatus.IN_USE,
    endDate: "2026-10-06T00:00:00.000Z",
    returnedAt: null,
  };

  assert.equal(hasPendingMachineAction(overdueInUse, now), true);
  assert.equal(machineHasPendingAction([overdueInUse], now), true);
  assert.equal(machineHasPendingAction([futureInUse], now), false);
  assert.equal(
    machineHasPendingAction(
      [{ status: MachineStatus.QUEUED, endDate: null, returnedAt: null }],
      now,
    ),
    true,
  );
  assert.equal(machineHasPendingAction(undefined, now), false);
});

test("a loan due today is not overdue", () => {
  const now = new Date("2026-09-30T03:00:00.000Z");
  assert.equal(loanOverdueDays("2026-09-30T00:00:00.000Z", now), 0);
  assert.equal(loanOverdueDays("2026-09-28T00:00:00.000Z", now), 2);
});
