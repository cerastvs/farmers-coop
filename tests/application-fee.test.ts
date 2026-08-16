import assert from "node:assert/strict";
import test from "node:test";

import { PaymentMethod } from "../app/generated/prisma";
import {
  getApplicationFeeAmount,
  MembershipReviewSchema,
  parseApplicationFeeSubmission,
  SearchSchema,
} from "../lib/application-fee";
import { ApiError } from "../lib/errors";
import {
  applicationFeePaymentTransitions,
  assertTransition,
} from "../lib/lifecycles";

function imageFile(type = "image/jpeg") {
  const signatures: Record<string, number[]> = {
    "image/jpeg": [0xff, 0xd8, 0xff, 0xe0],
    "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    "image/webp": [
      0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ],
  };
  return new File(
    [new Uint8Array(signatures[type] ?? [0x00]), new Uint8Array([0x01, 0x02])],
    "proof-image",
    { type },
  );
}

async function expectApiError(
  operation: () => unknown | Promise<unknown>,
  status: number,
  message: string,
) {
  await assert.rejects(Promise.resolve().then(operation), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, status);
    assert.equal(error.message, message);
    return true;
  });
}

test("application fee amount defaults to 500 and coerces valid env values", () => {
  const previous = process.env.APPLICATION_FEE_AMOUNT;
  try {
    delete process.env.APPLICATION_FEE_AMOUNT;
    assert.equal(getApplicationFeeAmount(), 500);

    process.env.APPLICATION_FEE_AMOUNT = "250.5";
    assert.equal(getApplicationFeeAmount(), 250.5);

    process.env.APPLICATION_FEE_AMOUNT = "not-a-number";
    assert.equal(getApplicationFeeAmount(), 500);
  } finally {
    if (previous === undefined) delete process.env.APPLICATION_FEE_AMOUNT;
    else process.env.APPLICATION_FEE_AMOUNT = previous;
  }
});

test("online application fee submissions parse the proof and reference", async () => {
  const formData = new FormData();
  formData.set("paymentMethod", "ONLINE");
  formData.set("referenceNo", "GCASH-1234");
  formData.set("proofOfPayment", imageFile());

  const submission = await parseApplicationFeeSubmission(Promise.resolve(formData));

  assert.equal(submission.paymentMethod, PaymentMethod.ONLINE);
  assert.equal(submission.referenceNo, "GCASH-1234");
  assert.ok(submission.proofOfPayment instanceof File);
});

test("online submissions default the method to ONLINE", async () => {
  const formData = new FormData();
  formData.set("proofOfPayment", imageFile());

  const submission = await parseApplicationFeeSubmission(Promise.resolve(formData));

  assert.equal(submission.paymentMethod, PaymentMethod.ONLINE);
});

test("online submissions reject missing proof of payment", async () => {
  const formData = new FormData();
  formData.set("paymentMethod", "ONLINE");

  await expectApiError(
    () => parseApplicationFeeSubmission(Promise.resolve(formData)),
    400,
    "Proof of payment is required",
  );
});

test("online submissions reject unsupported proof file types", async () => {
  const formData = new FormData();
  formData.set("paymentMethod", "ONLINE");
  formData.set("proofOfPayment", imageFile("application/pdf"));

  await expectApiError(
    () => parseApplicationFeeSubmission(Promise.resolve(formData)),
    400,
    "Proof of payment must be a JPEG, PNG, or WebP image",
  );
});

test("on-site submissions are rejected from the applicant path", async () => {
  const formData = new FormData();
  formData.set("paymentMethod", "ON_SITE");

  await expectApiError(
    () => parseApplicationFeeSubmission(Promise.resolve(formData)),
    400,
    "On-site payments are recorded by cooperative staff instead.",
  );
});

test("application fee search schema parses query filters", () => {
  assert.deepEqual(
    SearchSchema.parse({ search: "Jose Rizal" }),
    { search: "Jose Rizal" },
  );
  assert.deepEqual(
    SearchSchema.parse({ search: "  ", status: "PENDING_PAYMENT" }),
    { search: "", status: "PENDING_PAYMENT" },
  );
  assert.equal(
    SearchSchema.safeParse({ status: "NOT_A_STATUS" }).success,
    false,
  );
});

test("application fee payment transitions only allow approve and decline", () => {
  assertTransition(
    applicationFeePaymentTransitions,
    "PENDING_APPROVAL" as never,
    "APPROVED" as never,
    "Application fee payment",
  );
  assertTransition(
    applicationFeePaymentTransitions,
    "PENDING_APPROVAL" as never,
    "DECLINED" as never,
    "Application fee payment",
  );
  assert.throws(() =>
    assertTransition(
      applicationFeePaymentTransitions,
      "DECLINED" as never,
      "PENDING_APPROVAL" as never,
      "Application fee payment",
    ),
  );
});

test("membership review approve does not require a reason", () => {
  assert.deepEqual(
    MembershipReviewSchema.parse({ action: "approve" }),
    { action: "approve" },
  );
});

test("membership review deny requires a reason", () => {
  assert.equal(MembershipReviewSchema.safeParse({ action: "deny" }).success, false);
  assert.equal(
    MembershipReviewSchema.safeParse({ action: "deny", reason: "" }).success,
    false,
  );
  assert.deepEqual(
    MembershipReviewSchema.parse({
      action: "deny",
      reason: "Incomplete application",
      explanation: "Farm documents are missing.",
    }),
    {
      action: "deny",
      reason: "Incomplete application",
      explanation: "Farm documents are missing.",
    },
  );
});

test("membership review deny with Other requires an explanation", () => {
  assert.equal(
    MembershipReviewSchema.safeParse({
      action: "deny",
      reason: "Other",
    }).success,
    false,
  );
  assert.deepEqual(
    MembershipReviewSchema.parse({
      action: "deny",
      reason: "Other",
      explanation: "The applicant moved to another province.",
    }),
    {
      action: "deny",
      reason: "Other",
      explanation: "The applicant moved to another province.",
    },
  );
});

test("membership review rejects unknown actions", () => {
  assert.equal(
    MembershipReviewSchema.safeParse({ action: "maybe" }).success,
    false,
  );
});
