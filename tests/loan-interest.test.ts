import assert from "node:assert/strict";
import test from "node:test";

import {
  applyLoanInterest,
  principalFromAmount,
} from "../lib/loan-math";

test("applying interest produces a rounded payable", () => {
  assert.equal(applyLoanInterest(5000, 2), 5100);
  assert.equal(applyLoanInterest(10000, 2), 10200);
  assert.equal(applyLoanInterest(123.45, 2), 125.92);
});

test("principalFromAmount recovers the original loan before interest", () => {
  assert.equal(principalFromAmount(5100, 2), 5000);
  assert.equal(principalFromAmount(10200, 2), 10000);
});

test("principalFromAmount round-trips applyLoanInterest", () => {
  for (const principal of [100, 500, 1234.56, 8000]) {
    const payable = applyLoanInterest(principal, 2);
    assert.equal(principalFromAmount(payable, 2), principal);
  }
});

test("principalFromAmount treats an invalid rate as no interest", () => {
  assert.equal(principalFromAmount(1000, NaN), 1000);
  assert.equal(principalFromAmount(1000, -5), 1000);
});