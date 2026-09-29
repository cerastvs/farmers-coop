import { NextResponse } from "next/server";

import {
  ApplicationStatus,
  PaymentType,
  Prisma,
  Role,
} from "@/app/generated/prisma";
import { notifyUser, writeAudit } from "@/lib/activity";
import { apiErrorResponse, ApiError, requireUser } from "@/lib/api";
import {
  findSettledApplicationFee,
  getApplicationFeeAmount,
} from "@/lib/application-fee";
import prisma from "@/lib/client";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser([Role.PRESIDENT]);
    const { id } = await params;
    const application = await prisma.application.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        fullName: true,
        status: true,
      },
    });

    if (!application) {
      throw new ApiError(404, "Application not found");
    }

    if (
      application.status !== ApplicationStatus.PENDING &&
      application.status !== ApplicationStatus.PENDING_APPLICATION_REVIEW
    ) {
      throw new ApiError(409, "Application is already processed");
    }

    const reviewedAt = new Date();
    const requiredFee = getApplicationFeeAmount();
    await prisma.$transaction(
      async (tx) => {
        // Membership grants borrowing, supply credit and machine access, so it
        // must not be granted while the application fee is unsettled. Re-read
        // inside the transaction rather than checking before it: a fee proof
        // could otherwise be reversed between the check and the approval, and
        // the status gate below would approve a membership with no valid fee.
        const feePayments = await tx.payment.findMany({
          where: { applicationId: application.id, type: PaymentType.APPLICATION_FEE },
          select: { status: true, amount: true },
        });
        if (!findSettledApplicationFee(feePayments, requiredFee)) {
          throw new ApiError(
            409,
            `The application fee of ₱${requiredFee.toLocaleString()} has not been verified for this application. Verify the fee payment before approving membership.`,
          );
        }

        // Conditional update so a concurrent approval cannot double-apply, and
        // so the state we validated above is the state we actually move.
        const claimed = await tx.application.updateMany({
          where: {
            id,
            status: {
              in: [
                ApplicationStatus.PENDING,
                ApplicationStatus.PENDING_APPLICATION_REVIEW,
              ],
            },
          },
          data: {
            status: ApplicationStatus.APPROVED,
            reviewedBy: actor.userId,
            reviewedAt,
            rejectionReason: null,
          },
        });
        if (claimed.count === 0) {
          throw new ApiError(409, "Application is already processed");
        }
        await tx.user.update({
          where: { id: application.userId },
          data: {
            role: Role.MEMBER,
            active: true,
          },
        });
        await notifyUser(tx, {
          userId: application.userId,
          title: "Membership approved",
          message:
            "Your cooperative membership application was approved. Member services are now available.",
        });
        await writeAudit(tx, {
          userId: actor.userId,
          action: "MEMBERSHIP_APPLICATION_APPROVED",
          entity: "Application",
          entityId: id,
          metadata: {
            applicantUserId: application.userId,
            reviewedAt: reviewedAt.toISOString(),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json({
      success: true,
      status: ApplicationStatus.APPROVED,
      reviewedAt,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to approve application");
  }
}
