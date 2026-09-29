import assert from "node:assert/strict";
import { test } from "node:test";

import { Prisma } from "../app/generated/prisma";
import {
  ACCOUNT_EVENTS,
  MAX_DEACTIVATION_REASON,
  summarizeAccountEvents,
  type AccountEvent,
} from "../lib/account-status-core";

const at = (minutes: number) => new Date(Date.UTC(2026, 0, 1, 0, minutes));

const event = (
  action: string,
  minutes: number,
  metadata: Prisma.JsonValue = {},
): AccountEvent => ({ action, createdAt: at(minutes), metadata });

/**
 * The account status a disabled member sees is folded out of the audit trail.
 * These tests pin the folding rule, because a mistake here either hides a
 * pending request from the officers or shows one that was already answered.
 */
test("a fresh account has no status", () => {
  const status = summarizeAccountEvents([]);
  assert.equal(status.openReactivationRequest, null);
  assert.equal(status.deactivationReason, null);
  assert.equal(status.deactivatedAt, null);
});

test("a deactivation exposes its reason to the member", () => {
  const status = summarizeAccountEvents([
    event(ACCOUNT_EVENTS.deactivated, 10, { reason: "Unpaid dues for 2025" }),
  ]);
  assert.equal(status.deactivationReason, "Unpaid dues for 2025");
  assert.deepEqual(status.deactivatedAt, at(10));
  assert.equal(status.openReactivationRequest, null);
});

test("a deactivation without a reason is still a deactivation", () => {
  const status = summarizeAccountEvents([event(ACCOUNT_EVENTS.deactivated, 10)]);
  assert.equal(status.deactivationReason, null);
  assert.deepEqual(status.deactivatedAt, at(10));
});

test("an empty or blank reason is treated as no reason", () => {
  for (const reason of ["", "   "]) {
    const status = summarizeAccountEvents([
      event(ACCOUNT_EVENTS.deactivated, 10, { reason }),
    ]);
    assert.equal(status.deactivationReason, null);
  }
});

test("a request is open once made, and still shows the deactivation reason", () => {
  const status = summarizeAccountEvents([
    event(ACCOUNT_EVENTS.deactivated, 10, { reason: "Under investigation" }),
    event(ACCOUNT_EVENTS.reactivationRequested, 20, { message: "I settled the dues" }),
  ]);

  assert.ok(status.openReactivationRequest);
  assert.equal(status.openReactivationRequest.message, "I settled the dues");
  assert.deepEqual(status.openReactivationRequest.at, at(20));
  // The reason must survive so officers can judge the request.
  assert.equal(status.deactivationReason, "Under investigation");
});

test("reactivating closes the request without anyone dismissing it", () => {
  const status = summarizeAccountEvents([
    event(ACCOUNT_EVENTS.deactivated, 10, { reason: "Under investigation" }),
    event(ACCOUNT_EVENTS.reactivationRequested, 20),
    event(ACCOUNT_EVENTS.reactivated, 30),
  ]);

  assert.equal(status.openReactivationRequest, null);
});

test("a request after reactivation is a fresh, open request", () => {
  const status = summarizeAccountEvents([
    event(ACCOUNT_EVENTS.deactivated, 10),
    event(ACCOUNT_EVENTS.reactivated, 20),
    event(ACCOUNT_EVENTS.reactivationRequested, 30),
  ]);

  assert.ok(status.openReactivationRequest);
  assert.deepEqual(status.openReactivationRequest.at, at(30));
});

test("the newest event wins regardless of stored order", () => {
  const events = [
    event(ACCOUNT_EVENTS.reactivationRequested, 30),
    event(ACCOUNT_EVENTS.reactivated, 20),
    event(ACCOUNT_EVENTS.deactivated, 10),
  ];
  // Audit rows come back newest-first, but the fold must not depend on that:
  // a future query order change must not silently flip who is "pending".
  const forwards = summarizeAccountEvents(events);
  const backwards = summarizeAccountEvents([...events].reverse());

  assert.deepEqual(forwards, backwards);
  assert.ok(forwards.openReactivationRequest);
});

test("the most recent deactivation reason is the one shown", () => {
  const status = summarizeAccountEvents([
    event(ACCOUNT_EVENTS.deactivated, 10, { reason: "First reason" }),
    event(ACCOUNT_EVENTS.reactivated, 20),
    event(ACCOUNT_EVENTS.deactivated, 30, { reason: "Second reason" }),
  ]);

  assert.equal(status.deactivationReason, "Second reason");
  assert.deepEqual(status.deactivatedAt, at(30));
});

test("a request with no note is still open", () => {
  const status = summarizeAccountEvents([
    event(ACCOUNT_EVENTS.reactivationRequested, 20),
  ]);
  assert.ok(status.openReactivationRequest);
  assert.equal(status.openReactivationRequest.message, null);
});

test("non-object metadata cannot crash the fold", () => {
  const oddities: Prisma.JsonValue[] = [null, "text", 42, ["a"]];
  for (const metadata of oddities) {
    const status = summarizeAccountEvents([
      event(ACCOUNT_EVENTS.deactivated, 10, metadata),
    ]);
    assert.equal(status.deactivationReason, null);
    assert.deepEqual(status.deactivatedAt, at(10));
  }
});

test("the reason length limit fits the notice page and the officer prompt", () => {
  // Both the confirm modal and the member's note share this bound, so a reason
  // recorded through the API can never exceed what the UI can show.
  assert.equal(MAX_DEACTIVATION_REASON, 500);
});
