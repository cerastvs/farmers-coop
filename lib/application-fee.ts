import { z } from "zod";

import { PaymentMethod } from "@/app/generated/prisma";
import { ApiError } from "@/lib/errors";
import {
  MAX_PAYMENT_REQUEST_BYTES,
  readMultipartFormData,
  readProofOfPaymentFile,
} from "@/lib/payment-proof";

export const SearchSchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    status: z
      .enum([
        "PENDING_PAYMENT",
        "PENDING_APPLICATION_REVIEW",
        "APPROVED",
        "REJECTED",
        "PENDING",
      ])
      .optional(),
  })
  .strict();

export const APPLICATION_DENIAL_REASONS = [
  "Incomplete application",
  "Invalid information",
  "Does not meet membership requirements",
  "Required documents missing",
  "Application information could not be verified",
  "Other",
] as const;

export const MembershipReviewSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("approve"),
    })
    .strict(),
  z
    .object({
      action: z.literal("deny"),
      reason: z.string().trim().min(1).max(200),
      explanation: z.string().trim().max(1000).optional(),
    })
    .superRefine((value, ctx) => {
      const explanation = value.explanation?.trim() ?? "";
      if (value.reason.toLowerCase() === "other" && !explanation) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'An explanation is required when the reason is "Other"',
        });
      }
    })
    .strict(),
]);

export function getApplicationFeeAmount() {
  const raw = process.env.APPLICATION_FEE_AMOUNT?.trim();
  if (!raw) return 500;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return 500;
  return Math.round(amount * 100) / 100;
}

export function getApplicationFeeQrUrl() {
  return (
    process.env.APPLICATION_FEE_QR_URL?.trim() || "/payment-qr.svg"
  );
}

export function getApplicationFeeAccountLabel() {
  return (
    process.env.APPLICATION_FEE_ACCOUNT_LABEL?.trim() ||
    "FarmCoop Cooperative · GCash 0917 123 4567"
  );
}

export function getApplicationFeeInstructions(): string[] {
  return [
    "Scan the QR code with your e-wallet (GCash, Maya, etc.) or bank app.",
    "Enter the exact application fee amount shown above.",
    "Enter your full name as the reference so we can match the payment to your application.",
    "Save the confirmation or screenshot, then upload it below as your proof of payment.",
  ];
}

const PaymentMethodSchema = z.nativeEnum(PaymentMethod).optional();

export type ApplicationFeeSubmission = {
  paymentMethod: PaymentMethod;
  referenceNo?: string;
  proofOfPayment: File;
};

export function readApplicationFeeSubmission(
  request: Request,
): Promise<ApplicationFeeSubmission> {
  return parseApplicationFeeSubmission(
    readMultipartFormData(request),
  );
}

export async function parseApplicationFeeSubmission(
  formDataPromise: Promise<FormData>,
): Promise<ApplicationFeeSubmission> {
  const formData = await formDataPromise;

  const rawMethod = formData.get("paymentMethod");
  const parsedMethod = rawMethod
    ? PaymentMethodSchema.safeParse(rawMethod)
    : { success: true as const, data: PaymentMethod.ONLINE };
  if (!parsedMethod.success) {
    throw new ApiError(400, "Invalid payment method");
  }
  const method = parsedMethod.data;

  const referenceValue = formData.get("referenceNo");
  const referenceNo =
    typeof referenceValue === "string" && referenceValue.trim()
      ? referenceValue.trim().slice(0, 100)
      : undefined;

  if (method === PaymentMethod.ONLINE) {
    const proofOfPayment = await readProofOfPaymentFile(formData);
    return { paymentMethod: method, referenceNo, proofOfPayment };
  }

  throw new ApiError(
    400,
    "On-site payments are recorded by cooperative staff instead.",
  );
}

export { MAX_PAYMENT_REQUEST_BYTES };
