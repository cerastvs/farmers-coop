import assert from "node:assert/strict";
import test from "node:test";

import {
  LoanStatus,
  MachineStatus,
  PaymentStatus,
  TransactionStatus,
} from "../app/generated/prisma";
import {
  assertTransition,
  calculateLoanDueDate,
  loanTransitions,
  machineTransitions,
  paymentTransitions,
  supplyTransitions,
} from "../lib/lifecycles";

test("loan due dates clamp to the final day of shorter months", () => {
  assert.equal(
    calculateLoanDueDate(new Date(2026, 0, 31, 12), 1).getDate(),
    28,
  );
  assert.equal(
    calculateLoanDueDate(new Date(2024, 0, 31, 12), 1).getDate(),
    29,
  );
});

test("loan lifecycle accepts review and repayment transitions", () => {
  assert.doesNotThrow(() =>
    assertTransition(
      loanTransitions,
      LoanStatus.PENDING,
      LoanStatus.APPROVED,
      "Loan",
    ),
  );
  assert.doesNotThrow(() =>
    assertTransition(
      loanTransitions,
      LoanStatus.ACTIVE,
      LoanStatus.PAID,
      "Loan",
    ),
  );
  assert.doesNotThrow(() =>
    assertTransition(
      loanTransitions,
      LoanStatus.ACTIVE,
      LoanStatus.OVERDUE,
      "Loan",
    ),
  );
  assert.doesNotThrow(() =>
    assertTransition(
      loanTransitions,
      LoanStatus.OVERDUE,
      LoanStatus.PAID,
      "Loan",
    ),
  );
  assert.doesNotThrow(() =>
    assertTransition(
      loanTransitions,
      LoanStatus.OVERDUE,
      LoanStatus.ACTIVE,
      "Loan",
    ),
  );
});

test("terminal workflow states reject further transitions", () => {
  assert.throws(() =>
    assertTransition(
      paymentTransitions,
      PaymentStatus.VERIFIED,
      PaymentStatus.REJECTED,
      "Payment",
    ),
  );
  assert.throws(() =>
    assertTransition(
      supplyTransitions,
      TransactionStatus.COMPLETED,
      TransactionStatus.REJECTED,
      "Supply request",
    ),
  );
  assert.throws(() =>
    assertTransition(
      machineTransitions,
      MachineStatus.RETURNED,
      MachineStatus.IN_USE,
      "Machine request",
    ),
  );
});

test("machine lifecycle supports approval, use, overdue, and return", () => {
  assert.doesNotThrow(() =>
    assertTransition(
      machineTransitions,
      MachineStatus.QUEUED,
      MachineStatus.APPROVED,
      "Machine request",
    ),
  );
  assert.doesNotThrow(() =>
    assertTransition(
      machineTransitions,
      MachineStatus.APPROVED,
      MachineStatus.IN_USE,
      "Machine request",
    ),
  );
  assert.doesNotThrow(() =>
    assertTransition(
      machineTransitions,
      MachineStatus.IN_USE,
      MachineStatus.OVERDUE,
      "Machine request",
    ),
  );
  assert.doesNotThrow(() =>
    assertTransition(
      machineTransitions,
      MachineStatus.OVERDUE,
      MachineStatus.RETURNED,
      "Machine request",
    ),
  );
});
