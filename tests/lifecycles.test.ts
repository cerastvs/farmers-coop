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
  MACHINE_HELD_STATUSES,
  machineTransitions,
  MEMBER_RETURNABLE_MACHINE_STATUSES,
  MEMBER_STARTABLE_MACHINE_STATUSES,
  OPEN_SUPPLY_STATUSES,
  paymentTransitions,
  supplyTransitions,
  TERMINAL_MACHINE_STATUSES,
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
      LoanStatus.ACTIVE,
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

test("an overdue machine can still be returned by the member", () => {
  // A member in arrears must be able to hand the machine back rather than be
  // stuck until an officer moves it. Previously OVERDUE was terminal for the
  // member and the only exit was an officer action.
  assert.doesNotThrow(() =>
    assertTransition(
      machineTransitions,
      MachineStatus.OVERDUE,
      MachineStatus.RETURN_PENDING,
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

test("machine status sets stay consistent with the transition map", () => {
  // These sets are the source of truth for the capacity, overlap, and overdue
  // guards. If they drift from the lifecycle, a machine can be double-booked or
  // counted against capacity while actually free.
  assert.deepEqual(
    [...MACHINE_HELD_STATUSES].sort(),
    [
      MachineStatus.APPROVED,
      MachineStatus.IN_USE,
      MachineStatus.RETURN_PENDING,
      MachineStatus.OVERDUE,
    ].sort(),
  );

  // A held state must be able to reach a state that is not held: the machine is
  // still out and can come back.
  for (const status of MACHINE_HELD_STATUSES) {
    const exits = machineTransitions[status] ?? [];
    assert.ok(
      exits.length > 0,
      `held state ${status} must have an exit transition`,
    );
  }

  // Terminal states hold nothing.
  assert.ok(!MACHINE_HELD_STATUSES.includes(MachineStatus.RETURNED));
  assert.ok(!MACHINE_HELD_STATUSES.includes(MachineStatus.REJECTED));
  assert.ok(!MACHINE_HELD_STATUSES.includes(MachineStatus.QUEUED));
});

test("the returnable set covers overdue but not already-returned machines", () => {
  assert.deepEqual(
    [...MEMBER_RETURNABLE_MACHINE_STATUSES].sort(),
    [MachineStatus.IN_USE, MachineStatus.OVERDUE].sort(),
  );
  // Once the return is initiated the member's part is done; officers confirm.
  assert.ok(
    !MEMBER_RETURNABLE_MACHINE_STATUSES.includes(
      MachineStatus.RETURN_PENDING,
    ),
  );
  // A booking that has not left the office is not something to "return".
  assert.ok(
    !MEMBER_RETURNABLE_MACHINE_STATUSES.includes(MachineStatus.APPROVED),
  );
});

test("only an approved booking can be started", () => {
  assert.deepEqual([...MEMBER_STARTABLE_MACHINE_STATUSES], [MachineStatus.APPROVED]);
});

test("open supply statuses exclude the terminal ones", () => {
  assert.deepEqual(
    [...OPEN_SUPPLY_STATUSES].sort(),
    [TransactionStatus.PENDING, TransactionStatus.APPROVED].sort(),
  );
});

test("terminal machine states are the ones with no way out", () => {
  assert.deepEqual(
    [...TERMINAL_MACHINE_STATUSES].sort(),
    [MachineStatus.RETURNED, MachineStatus.REJECTED].sort(),
  );
  for (const status of TERMINAL_MACHINE_STATUSES) {
    assert.deepEqual(machineTransitions[status], []);
  }
});

test("a queued request does not hold the machine", () => {
  // QUEUED is not terminal, but nothing has been granted yet: counting it
  // would let one member exhaust capacity with unapproved requests.
  assert.ok(!TERMINAL_MACHINE_STATUSES.includes(MachineStatus.QUEUED));
  assert.ok(!MACHINE_HELD_STATUSES.includes(MachineStatus.QUEUED));
});
