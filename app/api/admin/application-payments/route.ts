import { NextRequest, NextResponse } from "next/server";

import {
  ApplicationStatus,
  PaymentStatus,
  PaymentType,
  Role,
} from "@/app/generated/prisma";
import { apiErrorResponse, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { getApplicationFeeAmount, SearchSchema } from "@/lib/application-fee";

export async function GET(req: NextRequest) {
  try {
    await requireUser([Role.PRESIDENT]);

    const url = new URL(req.url);
    const searchResult = SearchSchema.safeParse({
      search: url.searchParams.get("search") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });
    const search = searchResult.success ? searchResult.data.search : undefined;
    const status = searchResult.success ? searchResult.data.status : undefined;

    const where = {
      type: PaymentType.APPLICATION_FEE,
      ...(search || status
        ? {
            application: {
              is: {
                ...(search
                  ? {
                      OR: [
                        { fullName: { contains: search, mode: "insensitive" as const } },
                        { id: { contains: search, mode: "insensitive" as const } },
                        { contact: { contains: search, mode: "insensitive" as const } },
                        {
                          user: {
                            username: { contains: search, mode: "insensitive" as const },
                          },
                        },
                      ],
                    }
                  : {}),
                ...(status ? { status: status as ApplicationStatus } : {}),
              },
            },
          }
        : {}),
    };

    const [payments, pendingApplications] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: {
          application: {
            select: {
              id: true,
              fullName: true,
              contact: true,
              status: true,
              createdAt: true,
              user: { select: { username: true } },
            },
          },
          user: { select: { id: true, name: true, username: true } },
          proofUploadedBy: {
            select: { id: true, name: true, username: true, role: true },
          },
          verifiedByUser: {
            select: { id: true, name: true, username: true, role: true },
          },
          declinedByUser: {
            select: { id: true, name: true, username: true, role: true },
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
          ...(search
            ? {
                OR: [
                  { fullName: { contains: search, mode: "insensitive" as const } },
                  { id: { contains: search, mode: "insensitive" as const } },
                  { contact: { contains: search, mode: "insensitive" as const } },
                  {
                    user: {
                      username: { contains: search, mode: "insensitive" as const },
                    },
                  },
                ],
              }
            : {}),
          ...(status === "PENDING_PAYMENT" || status === "PENDING"
            ? { status: status as ApplicationStatus }
            : {}),
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
              createdAt: payment.application.createdAt.toISOString(),
              username: payment.application.user.username,
            }
          : null,
        amount: Number(payment.amount),
        receiptUrl: payment.receiptUrl,
        referenceNo: payment.referenceNo,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        rejectionReason: payment.rejectionReason,
        createdAt: payment.createdAt.toISOString(),
        paidAt: payment.paidAt?.toISOString() ?? null,
        proofUploadedBy: payment.proofUploadedBy,
        proofUploadedAt: payment.proofUploadedAt?.toISOString() ?? null,
        verifiedBy: payment.verifiedByUser,
        verifiedAt: payment.verifiedAt?.toISOString() ?? null,
        declinedBy: payment.declinedByUser,
        declinedAt: payment.declinedAt?.toISOString() ?? null,
      })),
      pendingApplications: pendingApplications.map((application) => ({
        id: application.id,
        fullName: application.fullName,
        contact: application.contact,
        status: application.status,
        createdAt: application.createdAt.toISOString(),
      })),
      feeAmount: getApplicationFeeAmount(),
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch application fee payments");
  }
}
