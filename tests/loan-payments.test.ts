import assert from "node:assert/strict";
import test from "node:test";

import { LoanStatus, PaymentStatus, Prisma } from "../app/generated/prisma";
import { ApiError } from "../lib/errors";
import {
  applyVerifiedLoanPayment,
  generateReceiptNo,
  nextReceiptOrdinal,
  PaymentWithLoan,
} from "../lib/services/loan-payments";

type PaymentSeed = {
  id?: string;
  amount?: string;
  userId?: string;
  loan?: {
    id?: string;
    userId?: string;
    status?: LoanStatus;
    amount?: string;
    payments?: { amount: string }[];
  } | null;
};

function payment(overrides: PaymentSeed): PaymentWithLoan {
  const base = {
    id: overrides.id ?? "payment-1",
    userId: overrides.userId ?? "member-1",
    amount: new Prisma.Decimal(overrides.amount ?? "100"),
    loan: overrides.loan === null
      ? null
      : {
          id: overrides.loan?.id ?? "loan-1",
          userId: overrides.loan?.userId ?? "member-1",
          status: overrides.loan?.status ?? LoanStatus.ACTIVE,
          amount: new Prisma.Decimal(overrides.loan?.amount ?? "1000"),
          payments:
            overrides.loan?.payments?.map((p) => ({
              amount: new Prisma.Decimal(p.amount),
            })) ?? [],
        },
  };
  return base as unknown as PaymentWithLoan;
}

type FakeTx = {
  loanPayment: {
    create: (args: {
      data: { loanId: string; amount: Prisma.Decimal; receiptNo: string };
    }) => Promise<unknown>;
    findMany: (args: unknown) => Promise<{ receiptNo: string | null }[]>;
  };
  payment: {
    findMany: (args: unknown) => Promise<{ receiptNo: string | null }[]>;
  };
  loan: {
    updateMany: () => Promise<{ count: number }>;
  };
  loanStatusHistory: {
    create: () => Promise<unknown>;
  };
};

function fakeTx(
  events: string[],
  existingReceipts: string[] = [],
): FakeTx {
  return {
    loanPayment: {
      create: async (args: {
        data: { loanId: string; amount: Prisma.Decimal; receiptNo: string };
      }) => {
        events.push(`ledger:${args.data.loanId}:${args.data.amount.toNumber()}`);
        return {};
      },
      findMany: async () => existingReceipts.map((receiptNo) => ({ receiptNo })),
    },
    payment: {
      findMany: async () => [],
    },
    loan: {
      updateMany: async () => {
        events.push("loan:paid");
        return { count: 1 };
      },
    },
    loanStatusHistory: {
      create: async () => {
        events.push("history:PAID");
        return {};
      },
    },
  };
}

function txClient(events: string[]) {
  return fakeTx(events) as unknown as Prisma.TransactionClient;
}

test("rejects a payment exceeding the remaining balance", async () => {
  const events: string[] = [];

  await assert.rejects(
    applyVerifiedLoanPayment(
      txClient(events),
      payment({ amount: "500", loan: { amount: "1000", payments: [{ amount: "600" }] } }),
    ),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 409);
      assert.match(error.message, /exceeds the remaining balance of ₱400/);
      return true;
    },
  );
  assert.deepEqual(events, []);
});

test("rejects a payment on a non-active or foreign loan", async () => {
  const events: string[] = [];

  await assert.rejects(
    applyVerifiedLoanPayment(
      txClient(events),
      payment({ loan: { status: LoanStatus.PAID } }),
    ),
    (error: unknown) => error instanceof ApiError && error.status === 409,
  );

  await assert.rejects(
    applyVerifiedLoanPayment(
      txClient(events),
      payment({ userId: "other-member" }),
    ),
    (error: unknown) => error instanceof ApiError && error.status === 409,
  );

  await assert.rejects(
    applyVerifiedLoanPayment(txClient(events), payment({ loan: null })),
    (error: unknown) => error instanceof ApiError && error.status === 409,
  );
  assert.deepEqual(events, []);
});

test("records a partial payment without closing the loan", async () => {
  const events: string[] = [];

  await applyVerifiedLoanPayment(
    txClient(events),
    payment({ amount: "300", loan: { amount: "1000" } }),
  );

  assert.deepEqual(events, ["ledger:loan-1:300"]);
});

test("closes the loan when the final payment settles the balance", async () => {
  const events: string[] = [];

  await applyVerifiedLoanPayment(
    txClient(events),
    payment({ amount: "400", loan: { amount: "1000", payments: [{ amount: "600" }] } }),
  );

  assert.deepEqual(events, ["ledger:loan-1:400", "loan:paid", "history:PAID"]);
});

test("loan payments that fully settle are paid regardless of their own status", async () => {
  const events: string[] = [];
  const full = payment({ amount: "1000", loan: { amount: "1000" } });
  full.status = PaymentStatus.PENDING;

  await applyVerifiedLoanPayment(txClient(events), full);

  assert.deepEqual(events, ["ledger:loan-1:1000", "loan:paid", "history:PAID"]);
});

test("accepts a payment on an OVERDUE loan", async () => {
  const events: string[] = [];

  await applyVerifiedLoanPayment(
    txClient(events),
    payment({ loan: { status: LoanStatus.OVERDUE } }),
  );

  assert.deepEqual(events, ["ledger:loan-1:100"]);
});

test("fully settles an OVERDUE loan to PAID", async () => {
  const events: string[] = [];

  await applyVerifiedLoanPayment(
    txClient(events),
    payment({
      amount: "400",
      loan: { status: LoanStatus.OVERDUE, amount: "1000", payments: [{ amount: "600" }] },
    }),
  );

  assert.deepEqual(events, ["ledger:loan-1:400", "loan:paid", "history:PAID"]);
});

test("receipt numbers are sequential and cannot collide", async () => {
  const events: string[] = [];
  const tx = fakeTx(events, [
    "RCP-2026-000001",
    "RCP-2026-000002",
    "RCP-2026-000009",
  ]) as unknown as Prisma.TransactionClient & {
    loanPayment: { create: (args: { data: { receiptNo: string } }) => void };
  };

  const ordinal = await nextReceiptOrdinal(tx);
  assert.equal(ordinal, 10);

  // Previously the number came from an 8-character slice of a caller-supplied
  // seed, so the same supply + member + amount produced the same receipt on
  // every repeat dispatch within a year.
  const first = generateReceiptNo("member-1supply-a100.00", 10);
  const repeat = generateReceiptNo("member-1supply-a100.00", 11);
  assert.notEqual(first, repeat);
  assert.equal(first, `RCP-${new Date().getFullYear()}-000010`);
  assert.match(repeat, /^RCP-\d{4}-\d{6}$/);
});

test("the receipt sequence continues past gaps", async () => {
  const tx = fakeTx([], ["RCP-2026-000003"]) as unknown as Prisma.TransactionClient;

  // Gaps (a deleted or rejected receipt) must not cause a number to be reused.
  assert.equal(await nextReceiptOrdinal(tx), 4);
});

test("an empty ledger starts the sequence at one", async () => {
  const tx = fakeTx([], []) as unknown as Prisma.TransactionClient;

  assert.equal(await nextReceiptOrdinal(tx), 1);
});
