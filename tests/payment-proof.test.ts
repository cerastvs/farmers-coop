import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "../lib/errors";
import {
  MAX_PAYMENT_PROOF_BYTES,
  MAX_PAYMENT_REQUEST_BYTES,
  hasPaymentEvidence,
  parsePaymentSubmission,
  readPaymentSubmission,
  runReservedPaymentProofUpload,
  uploadPaymentProof,
} from "../lib/payment-proof";

function paymentForm(file?: File) {
  const formData = new FormData();
  formData.set("loanId", "21e2683f-ff87-4ba0-973b-0ca35652cd93");
  formData.set("amount", "125.50");
  if (file) formData.set("proofOfPayment", file);
  return formData;
}

function imageFile(
  type = "image/jpeg",
  bytes?: BlobPart[],
) {
  const signatures: Record<string, number[]> = {
    "image/jpeg": [0xff, 0xd8, 0xff, 0xe0],
    "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    "image/webp": [
      0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
    ],
  };
  const contents = bytes ?? [
    new Uint8Array(signatures[type] ?? [0x00]),
    new Uint8Array([0x01, 0x02]),
  ];
  return new File(contents, "proof-image", { type });
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

test("payment submissions parse multipart fields and require an image", async () => {
  const proof = imageFile();
  const submission = await parsePaymentSubmission(paymentForm(proof));

  assert.equal(submission.amount, 125.5);
  assert.equal(submission.proofOfPayment, proof);

  await expectApiError(
    () => parsePaymentSubmission(paymentForm()),
    400,
    "Proof of payment is required",
  );
});

test("payment submissions reject non-multipart request bodies", async () => {
  await expectApiError(
    () =>
      readPaymentSubmission(
        new Request("http://localhost/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }),
      ),
    415,
    "Payment submissions must use multipart/form-data",
  );
});

test("payment submissions reject obviously oversized request bodies before parsing", async () => {
  const request = new Request("http://localhost/api/payments", {
    method: "POST",
    headers: {
      "Content-Type": "multipart/form-data; boundary=unused",
      "Content-Length": String(MAX_PAYMENT_REQUEST_BYTES + 1),
    },
    body: "--unused--",
  });

  await expectApiError(
    () => readPaymentSubmission(request),
    413,
    "Payment submission is too large",
  );
});

test("payment proof validation rejects unsupported and oversized files", async () => {
  await expectApiError(
    () =>
      parsePaymentSubmission(
        paymentForm(imageFile("application/pdf")),
      ),
    400,
    "Proof of payment must be a JPEG, PNG, or WebP image",
  );

  await expectApiError(
    () =>
      parsePaymentSubmission(
        paymentForm(
          imageFile("image/png", [
            new Uint8Array([
              0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
            ]),
            new Uint8Array(MAX_PAYMENT_PROOF_BYTES),
          ]),
        ),
      ),
    400,
    "Proof of payment must be 5 MB or smaller",
  );
});

test("payment proof validation checks magic bytes against the declared type", async () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    const submission = await parsePaymentSubmission(
      paymentForm(imageFile(type)),
    );
    assert.equal(submission.proofOfPayment.type, type);
  }

  await expectApiError(
    () =>
      parsePaymentSubmission(
        paymentForm(
          imageFile("image/png", [
            new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
          ]),
        ),
      ),
    400,
    "Proof of payment content does not match its image type",
  );
});

test("payment proof uploads require ImgBB configuration", async () => {
  let fetchCalled = false;

  await expectApiError(
    () =>
      uploadPaymentProof(imageFile(), {
        apiKey: "",
        fetcher: async () => {
          fetchCalled = true;
          return Response.json({});
        },
      }),
    503,
    "Proof-of-payment uploads are not configured",
  );
  assert.equal(fetchCalled, false);
});

test("payment proof uploads return a validated secure URL", async () => {
  const proof = imageFile();
  let uploadedFile: FormDataEntryValue | null = null;

  const url = await uploadPaymentProof(proof, {
    apiKey: "test-key",
    fetcher: async (_input, init) => {
      uploadedFile = (init?.body as FormData).get("image");
      return Response.json({
        success: true,
        data: { display_url: "https://i.ibb.co/example/proof.jpg" },
      });
    },
  });

  assert.equal(uploadedFile, proof);
  assert.equal(url, "https://i.ibb.co/example/proof.jpg");
});

test("payment proof uploads translate provider failures safely", async () => {
  await expectApiError(
    () =>
      uploadPaymentProof(imageFile(), {
        apiKey: "test-key",
        fetcher: async () =>
          Response.json(
            { error: { message: "provider internals" } },
            { status: 500 },
          ),
      }),
    502,
    "Proof-of-payment upload failed",
  );
});

test("payment proof uploads time out with a sanitized error", async () => {
  await expectApiError(
    () =>
      uploadPaymentProof(imageFile(), {
        apiKey: "test-key",
        timeoutMs: 5,
        fetcher: async (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal;
            assert.ok(signal);
            signal.addEventListener(
              "abort",
              () => reject(signal.reason),
              { once: true },
            );
          }),
      }),
    504,
    "Proof-of-payment upload timed out",
  );
});

test("reserved uploads admit before upload and release on upload failure", async () => {
  const events: string[] = [];

  await expectApiError(
    () =>
      runReservedPaymentProofUpload({
        reserve: async () => {
          events.push("reserve");
          return "payment-id";
        },
        upload: async () => {
          events.push("upload");
          throw new ApiError(502, "Proof-of-payment upload failed");
        },
        complete: async () => {
          events.push("complete");
          return "done";
        },
        release: async (paymentId) => {
          assert.equal(paymentId, "payment-id");
          events.push("release");
        },
      }),
    502,
    "Proof-of-payment upload failed",
  );

  assert.deepEqual(events, ["reserve", "upload", "release"]);
});

test("completion failure releases the reservation after external upload", async () => {
  const events: string[] = [];

  await expectApiError(
    () =>
      runReservedPaymentProofUpload({
        reserve: async () => {
          events.push("reserve");
          return "payment-id";
        },
        upload: async () => {
          events.push("upload");
          return "https://i.ibb.co/example/orphaned-proof.jpg";
        },
        complete: async () => {
          events.push("complete");
          throw new ApiError(409, "Loan balance changed");
        },
        release: async () => {
          events.push("release");
        },
      }),
    409,
    "Loan balance changed",
  );

  // The database reservation is gone, but ImgBB cannot participate in the
  // database transaction, so a successfully uploaded object may be orphaned.
  assert.deepEqual(events, ["reserve", "upload", "complete", "release"]);
});

test("verification evidence accepts proofs and legacy references only", () => {
  assert.equal(
    hasPaymentEvidence({
      receiptUrl: "https://i.ibb.co/example/proof.jpg",
      referenceNo: null,
    }),
    true,
  );
  assert.equal(
    hasPaymentEvidence({ receiptUrl: null, referenceNo: "LEGACY-REF" }),
    true,
  );
  assert.equal(
    hasPaymentEvidence({ receiptUrl: null, referenceNo: null }),
    false,
  );
});
