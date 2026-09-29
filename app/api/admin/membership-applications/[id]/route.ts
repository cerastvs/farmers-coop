import { NextRequest, NextResponse } from "next/server";

import {
  ApplicationStatus,
  PaymentType,
  Prisma,
  Role,
} from "@/app/generated/prisma";
import { notifyUser, writeAudit } from "@/lib/activity";
import {
  findSettledApplicationFee,
  getApplicationFeeAmount,
  MembershipReviewSchema,
} from "@/lib/application-fee";
import { apiErrorResponse, ApiError, requireUser, readJsonBody } from "@/lib/api";
import prisma from "@/lib/client";

const userSummary = {
  id: true,
  name: true,
  username: true,
  role: true,
} as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser([Role.PRESIDENT]);
    const { id } = await params;
    if (!id) throw new ApiError(400, "Application ID is required");

    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        crops: true,
        machines: true,
        reviewedByUser: { select: userSummary },
        payments: {
          where: { type: PaymentType.APPLICATION_FEE },
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: userSummary },
            proofUploadedBy: { select: userSummary },
            verifiedByUser: { select: userSummary },
            declinedByUser: { select: userSummary },
          },
        },
      },
    });

    if (!application) {
      throw new ApiError(404, "Application not found");
    }

    const audit = await prisma.auditTrail.findMany({
      where: {
        OR: [
          { entity: "Application", entityId: application.id },
          {
            entity: "Payment",
            entityId: { in: application.payments.map((payment) => payment.id) },
          },
        ],
      },
      orderBy: { createdAt: "asc" },
      include: { user: { select: userSummary } },
    });

    const serializePayment = (payment: (typeof application.payments)[number]) => ({
      id: payment.id,
      status: payment.status,
      amount: Number(payment.amount),
      paymentMethod: payment.paymentMethod,
      referenceNo: payment.referenceNo,
      receiptUrl: payment.receiptUrl,
      createdAt: payment.createdAt.toISOString(),
      paidAt: payment.paidAt?.toISOString() ?? null,
      verifiedAt: payment.verifiedAt?.toISOString() ?? null,
      proofUploadedBy: payment.proofUploadedBy,
      proofUploadedAt: payment.proofUploadedAt?.toISOString() ?? null,
      verifiedBy: payment.verifiedByUser,
      declinedBy: payment.declinedByUser,
      declinedAt: payment.declinedAt?.toISOString() ?? null,
      rejectionReason: payment.rejectionReason,
    });

    return NextResponse.json({
      application: {
        id: application.id,
        userId: application.userId,
        firstName: application.firstName,
        middleName: application.middleName,
        lastName: application.lastName,
        extensionName: application.extensionName,
        fullName: application.fullName,
        birthDate: application.birthDate,
        gender: application.gender,
        address: application.address,
        contact: application.contact,
        farmSize: application.farmSize,
        crops: application.crops.map((c) => c.name),
        machines: application.machines.map((m) => m.name),
        yearsFarming: application.yearsFarming,
        farmOwnership: application.farmOwnership,
        farmOwnershipDetails: application.farmOwnershipDetails,
        guarantor: application.guarantor,
        validIdUrl: application.validIdUrl,
        proofOfFarmUrl: application.proofOfFarmUrl,
        status: application.status,
        createdAt: application.createdAt.toISOString(),
        reviewedBy: application.reviewedByUser,
        reviewedAt: application.reviewedAt?.toISOString() ?? null,
        rejectionReason: application.rejectionReason,
        rejectionDetails: application.rejectionDetails,
      },
      payments: application.payments.map(serializePayment),
      payment: application.payments[0]
        ? serializePayment(application.payments[0])
        : null,
      audit: audit.map((entry) => ({
        id: entry.id,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        createdAt: entry.createdAt.toISOString(),
        user: entry.user,
        metadata: entry.metadata,
      })),
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch membership application");
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser([Role.PRESIDENT]);
    const { id } = await params;
    if (!id) throw new ApiError(400, "Application ID is required");

    const parsed = MembershipReviewSchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0].message);
    }

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
      application.status !== ApplicationStatus.PENDING_APPLICATION_REVIEW &&
      application.status !== ApplicationStatus.PENDING
    ) {
      throw new ApiError(
        409,
        "This application has already been reviewed and is no longer pending",
      );
    }

    const reviewedAt = new Date();

    if (parsed.data.action === "approve") {
      const requiredFee = getApplicationFeeAmount();

      await prisma.$transaction(
        async (tx) => {
          // Membership grants borrowing, supply credit and machine access, so
          // it must not be granted while the application fee is unsettled. A
          // partial or unverified fee does not entitle the applicant to member
          // rights. Re-read inside the transaction so a fee reversed between
          // the check and the write cannot still produce an approval.
          const feePayments = await tx.payment.findMany({
            where: {
              applicationId: application.id,
              type: PaymentType.APPLICATION_FEE,
            },
            select: { status: true, amount: true },
          });
          if (!findSettledApplicationFee(feePayments, requiredFee)) {
            throw new ApiError(
              409,
              `The application fee of ₱${requiredFee.toLocaleString()} has not been verified for this application. Verify the fee payment before approving membership.`,
            );
          }

          // Conditional on the reviewed states so a concurrent review cannot
          // double-apply or approve an already-decided application.
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
              rejectionDetails: null,
            },
          });
          if (claimed.count === 0) {
            throw new ApiError(409, "Application is already processed");
          }
          await tx.user.update({
          where: { id: application.userId },
          data: { role: Role.MEMBER, active: true },
        });
        await notifyUser(tx, {
          userId: application.userId,
          title: "Membership Application Approved",
          message:
            "Congratulations! Your membership application has been approved by the President. You are now an official member of the cooperative.",
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
      });

      return NextResponse.json({
        success: true,
        status: ApplicationStatus.APPROVED,
        reviewedAt,
      });
    }

    const reason = parsed.data.reason.trim();
    const explanation = parsed.data.explanation?.trim() ?? null;

    await prisma.$transaction(
      async (tx) => {
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
            status: ApplicationStatus.REJECTED,
            reviewedBy: actor.userId,
            reviewedAt,
            rejectionReason: reason,
            rejectionDetails: explanation,
          },
        });
        if (claimed.count === 0) {
          throw new ApiError(409, "Application is already processed");
        }
        await notifyUser(tx, {
        userId: application.userId,
        title: "Membership Application Denied",
        message: `Unfortunately, your membership application was not approved.\n\nReason: ${reason}\n\nMessage from the President: ${explanation ?? "No additional explanation was provided."}`,
      });
      await writeAudit(tx, {
        userId: actor.userId,
        action: "MEMBERSHIP_APPLICATION_REJECTED",
        entity: "Application",
        entityId: id,
        metadata: {
          applicantUserId: application.userId,
          rejectionReason: reason,
          rejectionDetails: explanation,
          reviewedAt: reviewedAt.toISOString(),
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json({
      success: true,
      status: ApplicationStatus.REJECTED,
      rejectionReason: reason,
      rejectionDetails: explanation,
      reviewedAt,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to update membership application");
  }
}