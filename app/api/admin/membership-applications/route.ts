import { NextResponse } from "next/server";

import {
  ApplicationStatus,
  PaymentStatus,
  PaymentType,
  Role,
} from "@/app/generated/prisma";
import { apiErrorResponse, requireUser } from "@/lib/api";
import prisma from "@/lib/client";

const userSummary = {
  id: true,
  name: true,
  username: true,
  role: true,
} as const;

export async function GET() {
  try {
    await requireUser([Role.PRESIDENT]);

    const [applications, pendingPayments, deniedApplications, approvedMembers] =
      await Promise.all([
        prisma.application.findMany({
          orderBy: { createdAt: "desc" },
          include: {
            reviewedByUser: {
              select: { id: true, name: true, username: true, role: true },
            },
            payments: {
              where: { type: PaymentType.APPLICATION_FEE },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                status: true,
                paymentMethod: true,
                verifiedAt: true,
                verifiedByUser: {
                  select: userSummary,
                },
              },
            },
          },
        }),
        prisma.payment.count({
          where: {
            type: PaymentType.APPLICATION_FEE,
            status: PaymentStatus.PENDING_APPROVAL,
          },
        }),
        prisma.application.count({
          where: { status: ApplicationStatus.REJECTED },
        }),
        prisma.user.count({ where: { role: Role.MEMBER } }),
      ]);

    return NextResponse.json({
      counts: {
        pendingPaymentApprovals: pendingPayments,
        awaitingReview: applications.filter(
          (application) =>
            application.status === ApplicationStatus.PENDING_APPLICATION_REVIEW,
        ).length,
        denied: deniedApplications,
        approvedMembers,
      },
      applications: applications.map((application) => ({
        id: application.id,
        fullName: application.fullName,
        contact: application.contact,
        status: application.status,
        createdAt: application.createdAt.toISOString(),
        reviewedBy: application.reviewedByUser,
        reviewedAt: application.reviewedAt?.toISOString() ?? null,
        rejectionReason: application.rejectionReason,
        rejectionDetails: application.rejectionDetails,
        payment: application.payments[0]
          ? {
              id: application.payments[0].id,
              status: application.payments[0].status,
              paymentMethod: application.payments[0].paymentMethod,
              verifiedAt:
                application.payments[0].verifiedAt?.toISOString() ?? null,
              verifiedBy: application.payments[0].verifiedByUser,
            }
          : null,
      })),
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch membership applications");
  }
}