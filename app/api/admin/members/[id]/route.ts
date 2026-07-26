import { Prisma, Role } from "@/app/generated/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { notifyUser, writeAudit } from "@/lib/activity";
import { apiErrorResponse, ApiError, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { RECORDS_ROLES } from "@/lib/permissions";

const ProfileUpdateSchema = z
  .object({
    fullName: z.string().trim().min(3).max(120).optional(),
    age: z.coerce.number().int().min(18).max(100).optional(),
    gender: z.enum(["Male", "Female"]).optional(),
    address: z.string().trim().min(5).max(300).optional(),
    contact: z.string().trim().regex(/^[0-9]{10,15}$/).optional(),
    farmSize: z.coerce.number().positive().optional(),
    cropType: z.string().trim().min(2).max(100).optional(),
    yearsFarming: z.coerce.number().int().min(0).max(80).optional(),
  })
  .strict();

const MemberUpdateSchema = z
  .object({
    name: z.string().trim().min(3).max(120).nullable().optional(),
    username: z
      .string()
      .trim()
      .min(3)
      .max(20)
      .regex(/^[a-zA-Z0-9_]+$/)
      .optional(),
    role: z.nativeEnum(Role).optional(),
    active: z.boolean().optional(),
    profile: ProfileUpdateSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.username !== undefined ||
      value.role !== undefined ||
      value.active !== undefined ||
      (value.profile !== undefined &&
        Object.keys(value.profile).length > 0),
    "At least one member field is required",
  );

const memberSelect = {
  id: true,
  name: true,
  username: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  applications: {
    orderBy: { createdAt: "desc" as const },
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
} as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser(RECORDS_ROLES);
    const { id } = await params;
    const parsed = MemberUpdateSchema.safeParse(await req.json());

    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0].message);
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        active: true,
        applications: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!existing) {
      throw new ApiError(404, "Member not found");
    }
    if (parsed.data.profile && !existing.applications[0]) {
      throw new ApiError(409, "Member does not have an application profile");
    }

    const member = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          ...(parsed.data.name !== undefined
            ? { name: parsed.data.name }
            : {}),
          ...(parsed.data.username !== undefined
            ? { username: parsed.data.username }
            : {}),
          ...(parsed.data.role !== undefined
            ? { role: parsed.data.role }
            : {}),
          ...(parsed.data.active !== undefined
            ? { active: parsed.data.active }
            : {}),
        },
        select: memberSelect,
      });

      if (parsed.data.profile) {
        await tx.application.update({
          where: { id: existing.applications[0].id },
          data: parsed.data.profile,
        });
      }

      await writeAudit(tx, {
        userId: actor.userId,
        action: "MEMBER_RECORD_UPDATED",
        entity: "User",
        entityId: id,
        metadata: {
          fields: Object.keys(parsed.data),
          roleBefore: existing.role,
          roleAfter: parsed.data.role ?? existing.role,
          activeBefore: existing.active,
          activeAfter: parsed.data.active ?? existing.active,
        },
      });

      if (actor.userId !== id) {
        await notifyUser(tx, {
          userId: id,
          title: "Member record updated",
          message:
            "An authorized cooperative officer updated your member record.",
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id },
        select: memberSelect,
      });
    });

    const { applications, ...safeMember } = member;
    return NextResponse.json({
      message: "Member record updated",
      member: {
        ...safeMember,
        application: applications[0] ?? null,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return apiErrorResponse(
        new ApiError(409, "Username is already taken"),
        "Failed to update member record",
      );
    }
    return apiErrorResponse(error, "Failed to update member record");
  }
}
