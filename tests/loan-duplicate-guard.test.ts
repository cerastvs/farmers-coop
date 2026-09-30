import assert from "node:assert/strict";
import test from "node:test";

import "dotenv/config";

import { LoanStatus, LoanType } from "../app/generated/prisma";
import { conflictingLoanWhere } from "../lib/services/member-actions";

type SeedLoan = {
  id: string;
  userId: string;
  type: LoanType;
  status: LoanStatus;
};

const MEMBER = "member-1";

/**
 * Applies the generated Prisma `where` clause to a seed loan, mirroring
 * Prisma's semantics for the three operators the clause actually uses. This is
 * what makes the test about behaviour rather than about the shape of an
 * object: it is possible to write a clause that looks scoped and still match
 * the wrong loans.
 */
function clauseMatches(
  clause: ReturnType<typeof conflictingLoanWhere>,
  loan: SeedLoan,
): boolean {
  if (clause.userId !== loan.userId) return false;
  if (!clause.status.in.includes(loan.status)) return false;
  if (clause.type !== undefined && clause.type !== loan.type) return false;
  return true;
}

function blocked(
  type: LoanType,
  loans: SeedLoan[],
  memberId = MEMBER,
): boolean {
  return loans.some((loan) =>
    clauseMatches(conflictingLoanWhere(memberId, type), loan),
  );
}

const cashLoan: SeedLoan = {
  id: "cash-1",
  userId: MEMBER,
  type: LoanType.MONEY,
  status: LoanStatus.ACTIVE,
};

const supplyLoan: SeedLoan = {
  id: "supply-1",
  userId: MEMBER,
  type: LoanType.SUPPLY,
  status: LoanStatus.ACTIVE,
};

const pendingSupplyLoan: SeedLoan = {
  ...supplyLoan,
  id: "supply-2",
  status: LoanStatus.PENDING,
};

test("a supply loan does not block a cash loan request", () => {
  // The reported bug: a member who owed nothing on a cash loan but still had
  // supply debt was told they already had a cash loan account.
  assert.equal(blocked(LoanType.MONEY, [supplyLoan]), false);
  assert.equal(blocked(LoanType.MONEY, [pendingSupplyLoan]), false);
  assert.equal(blocked(LoanType.MONEY, [supplyLoan, pendingSupplyLoan]), false);
});

test("a cash loan does not block a supply loan request", () => {
  assert.equal(blocked(LoanType.SUPPLY, [cashLoan]), false);
});

test("a member may hold a cash loan and a supply loan at the same time", () => {
  const held = [cashLoan, supplyLoan];
  assert.equal(blocked(LoanType.MONEY, held), true, "second cash loan blocked");
  assert.equal(blocked(LoanType.SUPPLY, held), true, "second supply loan blocked");
});

test("a second loan of the same kind is still blocked", () => {
  // Scoping by type must not turn the guard off entirely.
  assert.equal(blocked(LoanType.MONEY, [cashLoan]), true);
  assert.equal(blocked(LoanType.SUPPLY, [supplyLoan]), true);
});

test("a settled loan of the same kind does not block anything", () => {
  // Paying off the cash loan frees the member to borrow again, which is what
  // the original report described working for the cash side.
  for (const settled of [LoanStatus.PAID, LoanStatus.REJECTED]) {
    const done: SeedLoan = { ...cashLoan, status: settled };
    assert.equal(blocked(LoanType.MONEY, [done]), false);
    assert.equal(blocked(LoanType.SUPPLY, [done]), false);
  }
});

test("another member's loan never blocks this one", () => {
  const other: SeedLoan = { ...cashLoan, userId: "member-2" };
  assert.equal(blocked(LoanType.MONEY, [other]), false);
});

test("the clause always carries a type, so a request can never match any loan", () => {
  // The original clause omitted `type` entirely for cash requests, which is
  // exactly what made the cash lookup match supply loans.
  for (const type of [LoanType.MONEY, LoanType.SUPPLY]) {
    assert.equal(conflictingLoanWhere(MEMBER, type).type, type);
  }
});
