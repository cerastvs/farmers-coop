import { NextResponse } from "next/server";

import { RECORDS_ROLES } from "@/lib/permissions";
import prisma from "@/lib/client";
import { apiErrorResponse, ApiError, requireUser } from "@/lib/api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser();
    const { id } = await params;

    if (
      actor.userId !== id &&
      !RECORDS_ROLES.includes(
        actor.userRole as (typeof RECORDS_ROLES)[number],
      )
    ) {
      throw new ApiError(403, "Forbidden");
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        applications: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            fullName: true,
            age: true,
            gender: true,
            address: true,
            contact: true,
            farmSize: true,
            cropType: true,
            yearsFarming: true,
            status: true,
            createdAt: true,
            reviewedBy: true,
            reviewedAt: true,
            rejectionReason: true,
          },
        },
      },
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const { applications, ...safeUser } = user;
    return NextResponse.json({
      ...safeUser,
      application: applications[0] ?? null,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch user");
  }
}
