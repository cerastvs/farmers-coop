import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { EntrySource, PaymentType } from "@/app/generated/prisma";
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api";
import { MEMBERSHIP_ROLES } from "@/lib/permissions";
import {
  readMultipartFormData,
  readProofOfPaymentFile,
  uploadPaymentProof,
} from "@/lib/payment-proof";
import { recordManualPayment } from "@/lib/services/member-actions";
import { officeManualContext } from "@/lib/services/admin-actions";

const ManualPaymentFieldsSchema = z
  .object({
    memberId: z.string().uuid(),
    type: z.nativeEnum(PaymentType),
    loanId: z.string().uuid().optional(),
    amount: z.coerce.number().positive().max(999_999_999.99).multipleOf(0.01),
    source: z.nativeEnum(EntrySource).default(EntrySource.OFFICE),
    remarks: z.string().trim().max(500).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.type !== PaymentType.LOAN_PAYMENT || value.loanId !== undefined,
    "loanId is required for loan payments",
  );

export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser(MEMBERSHIP_ROLES);
    const formData = await readMultipartFormData(req);

    const result = ManualPaymentFieldsSchema.safeParse({
      memberId: formData.get("memberId"),
      type: formData.get("type"),
      loanId: formData.get("loanId")?.toString() || undefined,
      amount: formData.get("amount"),
      source: formData.get("source")?.toString() || undefined,
      remarks: formData.get("remarks")?.toString() || undefined,
      reason: formData.get("reason")?.toString() || undefined,
    });
    if (!result.success) {
      throw new ApiError(400, result.error.issues[0].message);
    }

    const isLoanPayment = result.data.type === PaymentType.LOAN_PAYMENT;
    const hasProofFile =
      formData.get("proofOfPayment") instanceof File &&
      (formData.get("proofOfPayment") as File).size > 0;
    if (isLoanPayment && !hasProofFile) {
      throw new ApiError(400, "Proof of payment is required for loan payments");
    }

    const proofUrl = hasProofFile
      ? await uploadPaymentProof(await readProofOfPaymentFile(formData))
      : null;

    const payment = await recordManualPayment({
      actor,
      memberId: result.data.memberId,
      type: result.data.type,
      loanId: result.data.loanId,
      amount: result.data.amount,
      proofUrl,
      context: officeManualContext({
        memberId: result.data.memberId,
        source: result.data.source,
        remarks: result.data.remarks,
        reason: result.data.reason,
      }),
    });

    return NextResponse.json(
      { message: "Payment recorded", paymentId: payment.id },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to record payment");
  }
}
