import { GuarantorStatus } from "@/app/generated/prisma";
import { apiErrorResponse, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { FINANCE_ROLES } from "@/lib/permissions";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await requireUser(FINANCE_ROLES);

    const applications = await prisma.application.findMany({
      where: {
        guarantorStatus: GuarantorStatus.PENDING,
        user: { role: { in: ["MEMBER", "APPLICANT"] } },
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, username: true, role: true } },
        crops: { select: { name: true } },
        machines: { select: { name: true } },
      },
    });

    return NextResponse.json({
      pending: applications
        .filter((a) => {
          if (!a.guarantor || typeof a.guarantor !== "object") return false;
          const record = a.guarantor as Record<string, unknown>;
          return (
            String(record.firstName ?? "").trim() &&
            String(record.lastName ?? "").trim()
          );
        })
        .map((a) => ({
          applicationId: a.id,
          member: {
            id: a.user.id,
            name: a.user.name ?? a.user.username,
            username: a.user.username,
            role: a.user.role,
          },
          farm: {
            fullName: a.fullName,
            farmSize: a.farmSize,
            yearsFarming: a.yearsFarming,
            farmOwnership: a.farmOwnership,
            farmOwnershipDetails: a.farmOwnershipDetails,
            address: a.address,
            crops: a.crops.map((c) => c.name),
            machines: a.machines.map((m) => m.name),
          },
          guarantor: a.guarantor,
          submittedAt: a.createdAt.toISOString(),
          reviewedAt: a.guarantorReviewedAt?.toISOString() ?? null,
          rejectionReason: a.guarantorRejectionReason,
        })),
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch guarantor approvals");
  }
}