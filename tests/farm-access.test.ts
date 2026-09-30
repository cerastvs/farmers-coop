import assert from "node:assert/strict";
import test from "node:test";

import "dotenv/config";

import { FarmOwnership } from "../app/generated/prisma";
import {
  canBorrowMachines,
  canUseSupply,
  farmSizeApplies,
  hasHectareBasis,
  hectareBasis,
  isFarmWorker,
  needsFarmSizeReview,
  parseFarmSize,
} from "../lib/farm-access-core";

test("a farm worker is the only role with no land of their own", () => {
  assert.equal(isFarmWorker(FarmOwnership.FARM_WORKER), true);
  assert.equal(isFarmWorker(FarmOwnership.FARM_OWNER), false);
  assert.equal(isFarmWorker(FarmOwnership.OTHERS), false);
  assert.equal(isFarmWorker(null), false);
});

test("a farm size only applies to a member who is not a farm worker", () => {
  assert.equal(farmSizeApplies(FarmOwnership.FARM_OWNER), true);
  assert.equal(farmSizeApplies(FarmOwnership.OTHERS), true);
  assert.equal(farmSizeApplies(FarmOwnership.FARM_WORKER), false);
});

test("farm workers cannot borrow machines", () => {
  // One hectare is one machine-day, and a farm worker has no hectares. This
  // does not depend on the farm size being blank: a farm worker who still has
  // an old figure on file must not borrow against it.
  assert.equal(canBorrowMachines(FarmOwnership.FARM_WORKER), false);
  assert.equal(canBorrowMachines(FarmOwnership.FARM_OWNER), true);
  assert.equal(canBorrowMachines(FarmOwnership.OTHERS), true);
  assert.equal(canBorrowMachines(null), true);
});

test("a farm worker has no per-hectare basis even with a stale farm size", () => {
  assert.equal(hasHectareBasis(FarmOwnership.FARM_WORKER, 10), false);
  assert.equal(hectareBasis(FarmOwnership.FARM_WORKER, 10), null);
  // Switching to farm worker keeps the stored figure, which is exactly why the
  // stored figure must not be what the rules read.
  assert.equal(hasHectareBasis(FarmOwnership.FARM_OWNER, 10), true);
});

test("an owner who left the farm size blank has no per-hectare basis", () => {
  assert.equal(hasHectareBasis(FarmOwnership.FARM_OWNER, null), false);
  assert.equal(hasHectareBasis(FarmOwnership.FARM_OWNER, 0), false);
  assert.equal(hasHectareBasis(FarmOwnership.FARM_OWNER, -3), false);
  assert.equal(hasHectareBasis(FarmOwnership.FARM_OWNER, Number.NaN), false);
  assert.equal(hectareBasis(FarmOwnership.FARM_OWNER, null), null);
  assert.equal(hectareBasis(FarmOwnership.FARM_OWNER, 2.5), 2.5);
});

test("a supply with no per-hectare cap stays available to everyone", () => {
  // loanLimitPerHectare is optional per supply, so the common case does not
  // depend on a farm size at all.
  assert.equal(canUseSupply(null, true), true);
  assert.equal(canUseSupply(null, false), true);
  assert.equal(canUseSupply(undefined, false), true);
});

test("a per-hectare capped supply needs a farm size", () => {
  assert.equal(canUseSupply(5, true), true);
  assert.equal(canUseSupply(5, false), false);
});

test("a blank farm size is a real value, not a validation error", () => {
  assert.equal(parseFarmSize(""), null);
  assert.equal(parseFarmSize("   "), null);
  assert.equal(parseFarmSize(null), null);
  assert.equal(parseFarmSize(undefined), null);
  assert.equal(parseFarmSize("2.5"), 2.5);
  assert.equal(parseFarmSize("0.01"), 0.01);
  assert.equal(parseFarmSize(4), 4);
  // Nonsense must not silently become a usable number.
  assert.ok(Number.isNaN(parseFarmSize("abc")));
  assert.equal(hectareBasis(FarmOwnership.FARM_OWNER, parseFarmSize("abc")), null);
});

test("submitting the farm size already on file asks for nothing", () => {
  assert.equal(needsFarmSizeReview(2.5, 2.5), false);
  assert.equal(needsFarmSizeReview(null, null), false);
  // Clearing the field is a reduction, so it is not a request for more.
  assert.equal(needsFarmSizeReview(2.5, null), false);
  assert.equal(needsFarmSizeReview(2.5, Number.NaN), false);
});

test("raising or first setting the farm size asks for review", () => {
  // The member's current value keeps granting its allowance while pending, so
  // anything that would raise what they are entitled to must be reviewed.
  assert.equal(needsFarmSizeReview(2.5, 50), true);
  assert.equal(needsFarmSizeReview(null, 1), true);
  assert.equal(needsFarmSizeReview(5, 2.5), true);
});

test("a farm worker with a stored farm size still has nothing to divide by", () => {
  // The combination the rules exist for: hidden limited supplies, no machine
  // borrowing, and a stored figure that must go unused.
  const farmWorkerWithStaleSize = {
    farmOwnership: FarmOwnership.FARM_WORKER,
    farmSize: 8,
  };
  assert.equal(
    canBorrowMachines(farmWorkerWithStaleSize.farmOwnership),
    false,
  );
  assert.equal(
    hasHectareBasis(
      farmWorkerWithStaleSize.farmOwnership,
      farmWorkerWithStaleSize.farmSize,
    ),
    false,
  );
  assert.equal(canUseSupply(3, hasHectareBasis(
    farmWorkerWithStaleSize.farmOwnership,
    farmWorkerWithStaleSize.farmSize,
  )), false);
  // Unlimited supplies are still theirs to order.
  assert.equal(canUseSupply(null, hasHectareBasis(
    farmWorkerWithStaleSize.farmOwnership,
    farmWorkerWithStaleSize.farmSize,
  )), true);
});
