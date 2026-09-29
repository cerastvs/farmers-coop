import assert from "node:assert/strict";
import test from "node:test";

import { ReportType, Role } from "../app/generated/prisma";
import { ApiError } from "../lib/errors";
import {
  APPLICATION_STATUS_DOMAIN,
  validateStatuses,
} from "../lib/report-filters";

/**
 * Regression cover for a filter that was silently discarded.
 *
 * The member roster's "application status" filter was validated against the
 * Role domain, so every valid ApplicationStatus was rejected, the filter came
 * back empty, and the report ran completely unfiltered — an officer who
 * selected "Awaiting President review" received every applicant with no
 * warning that the filter had been thrown away.
 */

function expectBadRequest(
  operation: () => unknown,
  message: RegExp,
) {
  assert.throws(operation, (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 400);
    assert.match(error.message, message);
    return true;
  });
}

test("an application status is accepted by the application domain", () => {
  const result = validateStatuses(
    ReportType.MEMBERS,
    ["PENDING_APPLICATION_REVIEW"],
    APPLICATION_STATUS_DOMAIN,
  );

  assert.deepEqual(result, ["PENDING_APPLICATION_REVIEW"]);
});

test("a role is NOT a valid application status", () => {
  // MEMBER is a Role. Passing it as an application status is exactly the
  // mix-up that used to be swallowed.
  expectBadRequest(
    () =>
      validateStatuses(
        ReportType.MEMBERS,
        [Role.MEMBER],
        APPLICATION_STATUS_DOMAIN,
      ),
    /Invalid status value.*MEMBER/,
  );
});

test("an application status is NOT a valid role filter", () => {
  expectBadRequest(
    () => validateStatuses(ReportType.MEMBERS, ["PENDING_APPLICATION_REVIEW"]),
    /Invalid status value.*PENDING_APPLICATION_REVIEW/,
  );
});

test("valid values pass through unchanged, in order", () => {
  assert.deepEqual(
    validateStatuses(ReportType.LOANS, ["ACTIVE", "OVERDUE"]),
    ["ACTIVE", "OVERDUE"],
  );
});

test("an unknown status is rejected rather than dropped", () => {
  // Dropping would yield an empty filter and an unfiltered report.
  expectBadRequest(
    () => validateStatuses(ReportType.LOANS, ["ACTIVE", "NOT_A_STATUS"]),
    /NOT_A_STATUS/,
  );
});

test("a partially valid list is still rejected in full", () => {
  // No silent partial application: the officer's whole selection must be
  // valid, not the subset that happened to parse.
  expectBadRequest(
    () => validateStatuses(ReportType.MACHINES, ["APPROVED", "BOGUS"]),
    /BOGUS/,
  );
});

test("an absent or empty filter means no filtering", () => {
  assert.equal(validateStatuses(ReportType.LOANS, undefined), undefined);
  assert.equal(validateStatuses(ReportType.LOANS, []), undefined);
});

test("report types without a status domain ignore the filter", () => {
  // SUMMARY and AUDIT have no status column to filter on.
  assert.equal(validateStatuses(ReportType.SUMMARY, ["ACTIVE"]), undefined);
  assert.equal(validateStatuses(ReportType.AUDIT, ["ACTIVE"]), undefined);
});
