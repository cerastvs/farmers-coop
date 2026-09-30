import assert from "node:assert/strict";
import test from "node:test";

import "dotenv/config";

import {
  cashLoanBalance,
  hasOpenCashLoan,
} from "../app/dashboard/applyLoan/eligibility";

/**
 * The apply page had two gates that treated supply debt as blocking a cash
 * loan: the outstanding-balance gate, which read the combined total, and the
 * pending-request gate, which counted any open loan of any type. Between them
 * a member who owed only for supplies could not submit a cash application at
 * all, and the server rejected it too.
 */

test("an open supply loan does not block the cash form", () => {
  assert.equal(
    hasOpenCashLoan([{ type: "SUPPLY", status: "ACTIVE" }]),
    false,
  );
  assert.equal(
    hasOpenCashLoan([{ type: "SUPPLY", status: "PENDING" }]),
    false,
  );
  assert.equal(
    hasOpenCashLoan([
      { type: "SUPPLY", status: "ACTIVE" },
      { type: "SUPPLY", status: "PENDING" },
    ]),
    false,
  );
});

test("an open cash loan does block the cash form", () => {
  for (const status of ["PENDING", "ACTIVE"]) {
    assert.equal(hasOpenCashLoan([{ type: "MONEY", status }]), true, status);
  }
});

test("a settled or rejected cash loan does not block the cash form", () => {
  for (const status of ["PAID", "REJECTED", "OVERDUE"]) {
    assert.equal(hasOpenCashLoan([{ type: "MONEY", status }]), false, status);
  }
});

test("a supply loan alongside an open cash loan still blocks", () => {
  // The cash loan is the reason, not the supply loan.
  assert.equal(
    hasOpenCashLoan([
      { type: "SUPPLY", status: "ACTIVE" },
      { type: "MONEY", status: "ACTIVE" },
    ]),
    true,
  );
});

test("the balance that gates a cash loan is the cash balance alone", () => {
  assert.deepEqual(
    cashLoanBalance({ cash: 0, supply: 5000 }),
    { balance: 0, supplyBalance: 5000 },
  );
  assert.deepEqual(
    cashLoanBalance({ cash: 1200, supply: 5000 }),
    { balance: 1200, supplyBalance: 5000 },
  );
  assert.deepEqual(
    cashLoanBalance({ cash: 0, supply: 0 }),
    { balance: 0, supplyBalance: 0 },
  );
});

test("a member with only supply debt passes both cash gates", () => {
  // The reported case end to end: supply debt, no cash debt, no cash loan.
  const debt = cashLoanBalance({ cash: 0, supply: 5000 });
  const openLoans = [{ type: "SUPPLY", status: "ACTIVE" }];
  const blocked = debt.balance > 0 || hasOpenCashLoan(openLoans);
  assert.equal(blocked, false);
});
