import { z } from "zod";

import { ApiError } from "@/lib/errors";

export const MAX_PAYMENT_PROOF_BYTES = 5 * 1024 * 1024;
export const MAX_PAYMENT_REQUEST_BYTES =
  MAX_PAYMENT_PROOF_BYTES + 64 * 1024;
export const PAYMENT_PROOF_UPLOAD_TIMEOUT_MS = 10_000;
export const PAYMENT_PROOF_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const PaymentFieldsSchema = z.object({
  loanId: z.string().uuid(),
  amount: z.coerce.number().positive().max(5000).multipleOf(0.01),
});

export type PaymentSubmission = {
  loanId: string;
  amount: number;
  proofOfPayment: File;
};

export function hasPaymentEvidence(payment: {
  receiptUrl: string | null;
  referenceNo: string | null;
}) {
  return Boolean(payment.receiptUrl || payment.referenceNo);
}

export async function readMultipartFormData(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase();
  if (!contentType || !/^multipart\/form-data(?:;|$)/.test(contentType)) {
    throw new ApiError(
      415,
      "Payment submissions must use multipart/form-data",
    );
  }

  const contentLength = request.headers.get("content-length");
  if (
    contentLength &&
    Number.isFinite(Number(contentLength)) &&
    Number(contentLength) > MAX_PAYMENT_REQUEST_BYTES
  ) {
    throw new ApiError(413, "Payment submission is too large");
  }

  try {
    return await request.formData();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "Request body must be valid multipart form data");
  }
}

export async function readPaymentSubmission(request: Request) {
  return parsePaymentSubmission(await readMultipartFormData(request));
}

export async function readProofOfPaymentFile(
  formData: FormData,
): Promise<File> {
  const proofOfPayment = formData.get("proofOfPayment");
  if (!(proofOfPayment instanceof File) || proofOfPayment.size === 0) {
    throw new ApiError(400, "Proof of payment is required");
  }
  if (
    !PAYMENT_PROOF_TYPES.includes(
      proofOfPayment.type as (typeof PAYMENT_PROOF_TYPES)[number],
    )
  ) {
    throw new ApiError(
      400,
      "Proof of payment must be a JPEG, PNG, or WebP image",
    );
  }
  if (proofOfPayment.size > MAX_PAYMENT_PROOF_BYTES) {
    throw new ApiError(400, "Proof of payment must be 5 MB or smaller");
  }
  if (!(await hasMatchingImageSignature(proofOfPayment))) {
    throw new ApiError(
      400,
      "Proof of payment content does not match its image type",
    );
  }
  return proofOfPayment;
}

export async function parsePaymentSubmission(
  formData: FormData,
): Promise<PaymentSubmission> {
  const result = PaymentFieldsSchema.safeParse({
    loanId: formData.get("loanId"),
    amount: formData.get("amount"),
  });
  if (!result.success) {
    throw new ApiError(400, result.error.issues[0].message);
  }

  return { ...result.data, proofOfPayment: await readProofOfPaymentFile(formData) };
}

type UploadPaymentProofOptions = {
  apiKey?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
};

type ImgBbResponse = {
  success?: boolean;
  data?: {
    display_url?: unknown;
    url?: unknown;
  };
};

function safeImageUrl(value: unknown) {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function uploadPaymentProof(
  file: File,
  {
    apiKey = process.env.IMGBB_API,
    fetcher = fetch,
    timeoutMs = PAYMENT_PROOF_UPLOAD_TIMEOUT_MS,
  }: UploadPaymentProofOptions = {},
) {
  const configuredApiKey = apiKey?.trim();
  if (!configuredApiKey) {
    throw new ApiError(
      503,
      "Proof-of-payment uploads are not configured",
    );
  }

  const body = new FormData();
  body.append("image", file);
  const signal = AbortSignal.timeout(timeoutMs);

  let response: Response;
  try {
    response = await fetcher(
      `https://api.imgbb.com/1/upload?key=${encodeURIComponent(configuredApiKey)}`,
      { method: "POST", body, signal },
    );
  } catch {
    if (signal.aborted) {
      throw new ApiError(504, "Proof-of-payment upload timed out");
    }
    throw new ApiError(
      502,
      "Proof-of-payment upload service is unavailable",
    );
  }

  let data: ImgBbResponse;
  try {
    data = (await response.json()) as ImgBbResponse;
  } catch {
    if (signal.aborted) {
      throw new ApiError(504, "Proof-of-payment upload timed out");
    }
    throw new ApiError(
      502,
      "Proof-of-payment upload service returned an invalid response",
    );
  }

  const imageUrl = safeImageUrl(data.data?.display_url ?? data.data?.url);
  if (!response.ok || data.success !== true || !imageUrl) {
    throw new ApiError(502, "Proof-of-payment upload failed");
  }

  return imageUrl;
}

type ReservedPaymentProofUploadOptions<Reservation, Result> = {
  reserve: () => Promise<Reservation>;
  upload: () => Promise<string>;
  complete: (
    reservation: Reservation,
    receiptUrl: string,
  ) => Promise<Result>;
  release: (reservation: Reservation) => Promise<void>;
};

export async function runReservedPaymentProofUpload<Reservation, Result>({
  reserve,
  upload,
  complete,
  release,
}: ReservedPaymentProofUploadOptions<Reservation, Result>) {
  const reservation = await reserve();

  try {
    const receiptUrl = await upload();

    // PostgreSQL and external storage cannot commit atomically. If completion
    // fails after this point, release removes the unverifiable DB reservation,
    // but the already-uploaded ImgBB object can remain orphaned.
    return await complete(reservation, receiptUrl);
  } catch (error) {
    try {
      await release(reservation);
    } catch {
      throw new ApiError(500, "Payment submission cleanup failed");
    }
    throw error;
  }
}

async function hasMatchingImageSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());

  if (file.type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (file.type === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((byte, index) => bytes[index] === byte);
  }
  if (file.type === "image/webp") {
    return (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }

  return false;
}
