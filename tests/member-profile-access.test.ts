import assert from "node:assert/strict";
import { test } from "node:test";

import { Role } from "../app/generated/prisma";
import { canChangeRole, isRoleChange } from "../lib/member-profile-core";

/**
 * The privilege boundary for role changes: only the president may change a
 * member's role. Everyone else — secretary, treasurer — is refused, but a
 * request that does not actually change the role stays a harmless no-op so
 * editors can round-trip a full record without tripping the rule.
 */

test("a president may change a role to anything", () => {
  assert.equal(canChangeRole(Role.PRESIDENT, Role.MEMBER, Role.TREASURER), true);
  assert.equal(canChangeRole(Role.PRESIDENT, Role.MEMBER, Role.MEMBER), true);
  assert.equal(canChangeRole(Role.PRESIDENT, Role.PRESIDENT, undefined), true);
});

test("a secretary may not change a role", () => {
  assert.equal(canChangeRole(Role.SECRETARY, Role.MEMBER, Role.TREASURER), false);
  assert.equal(canChangeRole(Role.SECRETARY, Role.MEMBER, Role.PRESIDENT), false);
  // Even to hand themselves more power, and even downwards.
  assert.equal(canChangeRole(Role.SECRETARY, Role.MEMBER, Role.SECRETARY), false);
  assert.equal(canChangeRole(Role.SECRETARY, Role.PRESIDENT, Role.MEMBER), false);
});

test("a treasurer may not change a role", () => {
  assert.equal(canChangeRole(Role.TREASURER, Role.MEMBER, Role.SECRETARY), false);
});

test("an applicant (member self-edit) may not change a role", () => {
  assert.equal(canChangeRole(Role.APPLICANT, Role.APPLICANT, Role.PRESIDENT), false);
  assert.equal(canChangeRole(Role.MEMBER, Role.MEMBER, Role.PRESIDENT), false);
});

test("an unknown actor role may not change a role", () => {
  assert.equal(canChangeRole(undefined, Role.MEMBER, Role.TREASURER), false);
});

test("a non-president may submit a no-op role (unchanged value, or omitted)", () => {
  // Echoing the same value back must be allowed so round-tripping a record
  // never trips the guard.
  assert.equal(canChangeRole(Role.SECRETARY, Role.MEMBER, Role.MEMBER), true);
  assert.equal(canChangeRole(Role.SECRETARY, Role.MEMBER, undefined), true);
  assert.equal(canChangeRole(Role.TREASURER, Role.TREASURER, Role.TREASURER), true);
});

test("a non-president may still edit every non-role field", () => {
  // canChangeRole only guards the role; it must not block other updates.
  assert.equal(canChangeRole(Role.SECRETARY, Role.MEMBER, undefined), true);
});

test("isRoleChange detects a genuine change and ignores no-ops", () => {
  assert.equal(isRoleChange(Role.MEMBER, Role.TREASURER), true);
  assert.equal(isRoleChange(Role.MEMBER, Role.MEMBER), false);
  assert.equal(isRoleChange(Role.MEMBER, undefined), false);
});
