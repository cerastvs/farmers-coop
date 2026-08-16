import { NextResponse } from "next/server";

import {
  ApplicationStatus,
  PaymentStatus,
  PaymentType,
  Role,
} from "@/app/generated/prisma";
import { apiErrorResponse, requireUser } from "@/lib/api";
import prisma from "@/lib/client";

export async function GET() {
  try {
    await requireUser([Role.PRESIDENT]);

    const [payments, pendingApplications] = await Promise.all([
      prisma.payment.findMany({
      where: {
        type: PaymentType.APPLICATION_FEE,
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        application: {
          select: {
            id: true,
            fullName: true,
            contact: true,
            status: true,
          },
        },
        user: {
          select: { id: true, name: true, username: true },
        },
      },
    }),

    prisma.application.findMany({
      where: {
        status: {
          in: [
            ApplicationStatus.PENDING_PAYMENT,
            ApplicationStatus.PENDING,
          ],
        },
        payments: {
          none: {
            type: PaymentType.APPLICATION_FEE,
            status: {
              in: [PaymentStatus.PENDING_APPROVAL, PaymentStatus.APPROVED],
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        contact: true,
        status: true,
        createdAt: true,
      },
    }),
    ]);

    const sorted = [...payments].sort((a, b) => {
      const pendingA = a.status === PaymentStatus.PENDING_APPROVAL ? 0 : 1;
      const pendingB = b.status === PaymentStatus.PENDING_APPROVAL ? 0 : 1;
      if (pendingA !== pendingB) return pendingA - pendingB;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return NextResponse.json({
      payments: sorted.map((payment) => ({
        id: payment.id,
        user: {
          id: payment.user.id,
          name: payment.user.name ?? payment.user.username,
          username: payment.user.username,
        },
        application: payment.application
          ? {
              id: payment.application.id,
              fullName: payment.application.fullName,
              contact: payment.application.contact,
              status: payment.application.status,
            }
          : null,
        amount: Number(payment.amount),
        receiptUrl: payment.receiptUrl,
        referenceNo: payment.referenceNo,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        rejectionReason: payment.rejectionReason,
        createdAt: payment.createdAt.toISOString(),
        verifiedBy: payment.verifiedBy,
        verifiedAt: payment.verifiedAt?.toISOString() ?? null,
      })),
      pendingApplications: pendingApplications.map((application) => ({
        id: application.id,
        fullName: application.fullName,
        contact: application.contact,
        status: application.status,
        createdAt: application.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch application fee payments");
  }
}
