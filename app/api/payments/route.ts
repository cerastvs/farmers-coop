import {
  LoanStatus,
  PaymentStatus,
  PaymentType,
  Prisma,
  Role,
} from "@/app/generated/prisma";
import { notifyUser, writeAudit } from "@/lib/activity";
import {
  apiErrorResponse,
  ApiError,
  readJsonBody,
  requireUser,
} from "@/lib/api";
import prisma from "@/lib/client";
import { MEMBER_ROLES } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const PaymentSchema = z.object({
  loanId: z.string().uuid(),
  amount: z.number().positive().max(5000).multipleOf(0.01),
  referenceNo: z.string().trim().min(3).max(100).transform((value) =>
    value.toUpperCase()
  ),
}).strict();

export async function GET() {
  try {
    const actor = await requireUser(MEMBER_ROLES);
    const payments = await prisma.payment.findMany({
      where: { userId: actor.userId },
      orderBy: { createdAt: "desc" },
      include: { loan: { select: { name: true } } },
    });

    return NextResponse.json(
      payments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
      })),
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch payments");
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser(MEMBER_ROLES);
    const result = PaymentSchema.safeParse(await readJsonBody(req));
    if (!result.success) {
      throw new ApiError(400, result.error.issues[0].message);
    }

    const payment = await prisma.$transaction(
      async (tx) => {
        const loan = await tx.loan.findFirst({
          where: { id: result.data.loanId, userId: actor.userId },
          include: { payments: true },
        });
        if (!loan) throw new ApiError(404, "Loan not found");
        if (loan.status !== LoanStatus.ACTIVE) {
          throw new ApiError(409, "Only active loans can receive payments");
        }

        const paid = loan.payments.reduce(
          (sum, entry) => sum.plus(entry.amount),
          new Prisma.Decimal(0),
        );
        const balance = loan.amount.minus(paid);
        if (new Prisma.Decimal(result.data.amount).greaterThan(balance)) {
          throw new ApiError(
            400,
            `Payment cannot exceed the remaining balance of ₱${balance.toNumber().toLocaleString()}`,
          );
        }

        const duplicate = await tx.payment.findFirst({
          where: {
            userId: actor.userId,
            referenceNo: {
              equals: result.data.referenceNo,
              mode: "insensitive",
            },
            status: { not: PaymentStatus.REJECTED },
          },
          select: { id: true },
        });
        if (duplicate) {
          throw new ApiError(
            409,
            "This payment reference was already submitted",
          );
        }

        const created = await tx.payment.create({
          data: {
            userId: actor.userId,
            loanId: loan.id,
            type: PaymentType.LOAN_PAYMENT,
            amount: result.data.amount,
            referenceNo: result.data.referenceNo,
          },
        });
        await writeAudit(tx, {
          userId: actor.userId,
          action: "PAYMENT_SUBMITTED",
          entity: "Payment",
          entityId: created.id,
          metadata: {
            loanId: loan.id,
            amount: result.data.amount,
            referenceNo: result.data.referenceNo,
          },
        });
        const reviewers = await tx.user.findMany({
          where: {
            role: { in: [Role.TREASURER, Role.PRESIDENT] },
            active: true,
          },
          select: { id: true },
        });
        await Promise.all(
          reviewers.map((reviewer) =>
            notifyUser(tx, {
              userId: reviewer.id,
              title: "Payment awaiting verification",
              message: `A ₱${result.data.amount.toLocaleString()} loan payment is ready for review.`,
            }),
          ),
        );
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json(
      { message: "Payment submitted for verification", paymentId: payment.id },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to submit payment");
  }
}
