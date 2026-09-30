import assert from "node:assert/strict";
import test from "node:test";

import "dotenv/config";

import {
  supplyStatusClass,
  supplyStatusLabel,
} from "../app/dashboard/supplies/status";
import {
  SUPPLY_REQUEST_INTERVAL_MS,
  tooSoonAfterRequest,
} from "../lib/services/supply-requests";

const NOW = Date.parse("2026-09-30T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW - ms);

test("the interval is five seconds", () => {
  // Read as a cooldown it is short enough that nobody waits on it; it exists
  // only to absorb a double-clicked or retried submit.
  assert.equal(SUPPLY_REQUEST_INTERVAL_MS, 5_000);
});

test("a request made moments ago blocks an immediate repeat", () => {
  assert.equal(tooSoonAfterRequest(ago(0), NOW), true);
  assert.equal(tooSoonAfterRequest(ago(1_000), NOW), true);
  assert.equal(tooSoonAfterRequest(ago(4_999), NOW), true);
});

test("a request older than the interval no longer blocks", () => {
  assert.equal(tooSoonAfterRequest(ago(5_000), NOW), false);
  assert.equal(tooSoonAfterRequest(ago(5_001), NOW), false);
  assert.equal(tooSoonAfterRequest(ago(60_000), NOW), false);
  assert.equal(tooSoonAfterRequest(ago(86_400_000), NOW), false);
});

test("a member who never requested the item is not blocked", () => {
  assert.equal(tooSoonAfterRequest(null, NOW), false);
  assert.equal(tooSoonAfterRequest(undefined, NOW), false);
});

test("the interval is a throttle, not a business rule", () => {
  // Multiple open requests for the same item are fine. This used to be
  // rejected outright with "Member already has an open request for this item",
  // which meant waiting on a pickup before asking for the same thing again.
  // Only the five-second window stands in the way, and only just now.
  const memberMayRequestAgain = (lastRequestAt: Date | null) =>
    !tooSoonAfterRequest(lastRequestAt, NOW);
  assert.equal(memberMayRequestAgain(null), true);
  assert.equal(memberMayRequestAgain(ago(1)), false);
  assert.equal(memberMayRequestAgain(ago(3_000)), false);
  assert.equal(memberMayRequestAgain(ago(6_000)), true);
  assert.equal(memberMayRequestAgain(ago(10_000)), true);
});

test("an unpicked-up request reads as pending to the member", () => {
  // Approved but not yet collected means nothing has been received, so the
  // member should not see a state they have no action for.
  assert.equal(supplyStatusLabel("APPROVED"), "Pending");
  assert.equal(supplyStatusLabel("PENDING"), "Pending");
  assert.equal(supplyStatusLabel("APPROVED"), supplyStatusLabel("PENDING"));
});

test("the other states keep their own labels", () => {
  assert.equal(supplyStatusLabel("REJECTED"), "Rejected");
  assert.equal(supplyStatusLabel("COMPLETED"), "Picked up");
});

test("an unknown status is shown verbatim rather than hidden", () => {
  assert.equal(supplyStatusLabel("SOMETHING_NEW"), "SOMETHING_NEW");
  assert.ok(supplyStatusClass("SOMETHING_NEW").length > 0);
});

test("approved and pending share a style, so the two read as one state", () => {
  assert.equal(supplyStatusClass("APPROVED"), supplyStatusClass("PENDING"));
  assert.notEqual(supplyStatusClass("COMPLETED"), supplyStatusClass("PENDING"));
  assert.notEqual(supplyStatusClass("REJECTED"), supplyStatusClass("PENDING"));
});
