import { NextRequest, NextResponse } from "next/server";

import { Role } from "@/app/generated/prisma";
import { apiErrorResponse, ApiError, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { MEMBER_ROLES, RECORDS_ROLES } from "@/lib/permissions";

const exposedApplicationFields = {
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
} as const;

export async function GET(req: NextRequest) {
  try {
    await requireUser(RECORDS_ROLES);

    const search = req.nextUrl.searchParams.get("search")?.trim();
    const roleValue = req.nextUrl.searchParams.get("role");
    const activeValue = req.nextUrl.searchParams.get("active");

    if (roleValue && !Object.values(Role).includes(roleValue as Role)) {
      throw new ApiError(400, "Invalid role");
    }
    if (
      activeValue !== null &&
      activeValue !== "true" &&
      activeValue !== "false"
    ) {
      throw new ApiError(400, "active must be true or false");
    }

    const members = await prisma.user.findMany({
      where: {
        role: roleValue
          ? (roleValue as Role)
          : { in: [...MEMBER_ROLES] },
        ...(activeValue !== null ? { active: activeValue === "true" } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { username: { contains: search, mode: "insensitive" } },
                {
                  applications: {
                    some: {
                      fullName: { contains: search, mode: "insensitive" },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
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
          select: exposedApplicationFields,
        },
      },
    });

    return NextResponse.json({
      members: members.map(({ applications, ...member }) => ({
        ...member,
        application: applications[0] ?? null,
      })),
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch member records");
  }
}
