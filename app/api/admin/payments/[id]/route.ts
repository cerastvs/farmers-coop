import {
  LoanStatus,
  PaymentStatus,
  PaymentType,
  Prisma,
} from "@/app/generated/prisma";
import { notifyUser, writeAudit } from "@/lib/activity";
import {
  apiErrorResponse,
  ApiError,
  readJsonBody,
  requireUser,
  requireUuid,
} from "@/lib/api";
import prisma from "@/lib/client";
import {
  assertTransition,
  loanTransitions,
  paymentTransitions,
} from "@/lib/lifecycles";
import { hasPaymentEvidence } from "@/lib/payment-proof";
import { FINANCE_ROLES } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const VerifySchema = z.object({
  action: z.enum(["verify", "reject"]),
  reason: z.string().trim().min(1).max(500).optional(),
}).strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser(FINANCE_ROLES);
    const result = VerifySchema.safeParse(await readJsonBody(req));
    if (!result.success) {
      throw new ApiError(400, result.error.issues[0].message);
    }
    if (result.data.action === "reject" && !result.data.reason) {
      throw new ApiError(400, "A rejection reason is required");
    }

    const { id: rawId } = await params;
    const id = requireUuid(rawId, "Payment ID");

    await prisma.$transaction(
      async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { id },
          include: {
            loan: { include: { payments: true } },
          },
        });
        if (!payment) throw new ApiError(404, "Payment not found");

        const nextStatus =
          result.data.action === "verify"
            ? PaymentStatus.VERIFIED
            : PaymentStatus.REJECTED;
        if (
          nextStatus === PaymentStatus.VERIFIED &&
          !hasPaymentEvidence(payment)
        ) {
          throw new ApiError(
            409,
            "Payment cannot be verified without proof of payment",
          );
        }
        assertTransition(
          paymentTransitions,
          payment.status,
          nextStatus,
          "Payment",
        );

        if (
          nextStatus === PaymentStatus.VERIFIED &&
          payment.type !== PaymentType.LOAN_PAYMENT
        ) {
          throw new ApiError(
            409,
            "This payment type cannot be verified as a loan payment",
          );
        }

        const claimed = await tx.payment.updateMany({
          where: { id, status: payment.status },
          data: {
            status: nextStatus,
            verifiedBy: actor.userId,
            verifiedAt: new Date(),
            rejectionReason:
              nextStatus === PaymentStatus.REJECTED
                ? result.data.reason
                : null,
          },
        });
        if (claimed.count !== 1) {
          throw new ApiError(409, "Payment status changed during review");
        }

        if (nextStatus === PaymentStatus.VERIFIED) {
          if (!payment.loan) {
            throw new ApiError(409, "Payment is not linked to a loan");
          }
          if (payment.loan.userId !== payment.userId) {
            throw new ApiError(
              409,
              "Payment owner does not match the loan borrower",
            );
          }
          if (payment.loan.status !== LoanStatus.ACTIVE) {
            throw new ApiError(409, "The linked loan is not active");
          }

          const alreadyPaid = payment.loan.payments.reduce(
            (sum, entry) => sum.plus(entry.amount),
            new Prisma.Decimal(0),
          );
          const balance = payment.loan.amount.minus(alreadyPaid);
          if (payment.amount.greaterThan(balance)) {
            throw new ApiError(
              409,
              `Payment exceeds the current balance of ₱${balance.toNumber().toLocaleString()}`,
            );
          }

          await tx.loanPayment.create({
            data: {
              loanId: payment.loan.id,
              amount: payment.amount,
              receiptNo: `RCP-${new Date().getFullYear()}-${payment.id.slice(0, 8).toUpperCase()}`,
            },
          });

          if (payment.amount.equals(balance)) {
            assertTransition(
              loanTransitions,
              payment.loan.status,
              LoanStatus.PAID,
              "Loan",
            );
            const closed = await tx.loan.updateMany({
              where: {
                id: payment.loan.id,
                status: payment.loan.status,
              },
              data: { status: LoanStatus.PAID },
            });
            if (closed.count !== 1) {
              throw new ApiError(409, "Loan status changed during payment");
            }
            await tx.loanStatusHistory.create({
              data: { loanId: payment.loan.id, status: LoanStatus.PAID },
            });
          }
        }

        await notifyUser(tx, {
          userId: payment.userId,
          title:
            nextStatus === PaymentStatus.VERIFIED
              ? "Payment verified"
              : "Payment rejected",
          message:
            nextStatus === PaymentStatus.VERIFIED
              ? `Your ₱${Number(payment.amount).toLocaleString()} payment was applied to your loan.`
              : `Your payment was rejected. Reason: ${result.data.reason}`,
        });
        await writeAudit(tx, {
          userId: actor.userId,
          action:
            nextStatus === PaymentStatus.VERIFIED
              ? "PAYMENT_VERIFIED"
              : "PAYMENT_REJECTED",
          entity: "Payment",
          entityId: payment.id,
          metadata: result.data.reason
            ? { reason: result.data.reason }
            : undefined,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json({
      message: `Payment ${result.data.action === "verify" ? "verified" : "rejected"}`,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to process payment");
  }
}
