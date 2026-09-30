import assert from "node:assert/strict";
import test from "node:test";

import "dotenv/config";

import { needsFarmSizeReview } from "../lib/farm-access-core";
import { ApplicationSchema } from "../lib/validators/registration";

/**
 * A valid member application, so each test can change exactly one field.
 */
function baseApplication(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Juan",
    middleName: "",
    lastName: "Dela Cruz",
    extensionName: "",
    contact: "09171234567",
    address: "Barrio Poblacion, Sta. Maria",
    birthDate: "1990-05-04",
    gender: "Male",
    farmSize: "2.5",
    cropType: JSON.stringify(["Rice"]),
    yearsFarming: "5",
    farmOwnership: "FARM_OWNER",
    farmOwnershipDetails: "",
    farmMachinery: JSON.stringify(["Tractor"]),
    guarantor: {},
    validId: new File(["id"], "id.jpg", { type: "image/jpeg" }),
    proofOfFarm: new File(["farm"], "farm.jpg", { type: "image/jpeg" }),
    ...overrides,
  };
}

test("a farm owner can still give a farm size", () => {
  const result = ApplicationSchema.safeParse(baseApplication());
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.farmSize, 2.5);
});

test("a farm worker may leave the farm size blank", () => {
  // Farm size is optional because a farm worker has no land of their own. It
  // used to be a required positive number, so this used to fail.
  const result = ApplicationSchema.safeParse(
    baseApplication({ farmSize: "", farmOwnership: "FARM_WORKER" }),
  );
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.farmSize, null);
});

test("a blank farm size parses to null rather than zero", () => {
  // z.coerce.number() turns "" into 0, which would have looked like a real
  // (and wrong) farm size to everything downstream.
  const result = ApplicationSchema.safeParse(
    baseApplication({ farmSize: "   " }),
  );
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.farmSize, null);
});

test("a farm size that is not a number is still rejected", () => {
  const result = ApplicationSchema.safeParse(
    baseApplication({ farmSize: "abc" }),
  );
  assert.equal(result.success, false);
});

test("a farm size of zero or less is still rejected", () => {
  for (const farmSize of ["0", "-2"]) {
    const result = ApplicationSchema.safeParse(baseApplication({ farmSize }));
    assert.equal(result.success, false, `expected ${farmSize} to be rejected`);
  }
});

test("a raised farm size coming from the form asks for review", () => {
  // The form posts a string, so this is the path a real edit takes. It has to
  // come out as a pending review, otherwise the member's change would be
  // applied with no officer ever seeing it.
  const result = ApplicationSchema.safeParse(
    baseApplication({ farmSize: "12" }),
  );
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(needsFarmSizeReview(2.5, result.data.farmSize), true);
});

test("a farm role change that also changes the farm size asks for review", () => {
  // Switching to farm worker and re-stating a farm size in one save is still a
  // request for review, not a direct write.
  const result = ApplicationSchema.safeParse(
    baseApplication({ farmSize: "6", farmOwnership: "OTHERS" }),
  );
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(needsFarmSizeReview(2.5, result.data.farmSize), true);
});

test("leaving the farm size untouched does not ask for review", () => {
  // The form always posts the field, so an unchanged value must not create
  // noise in the officer queue.
  const result = ApplicationSchema.safeParse(baseApplication());
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(needsFarmSizeReview(2.5, result.data.farmSize), false);
});

test("a farm worker leaving the farm size blank does not ask for review", () => {
  const result = ApplicationSchema.safeParse(
    baseApplication({ farmSize: "", farmOwnership: "FARM_WORKER" }),
  );
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(needsFarmSizeReview(2.5, result.data.farmSize), false);
});
