import { Prisma, Role } from "@/app/generated/prisma";
import { z } from "zod";

import { notifyUser, writeAudit } from "@/lib/activity";
import { ApiError } from "@/lib/errors";
import prisma from "@/lib/client";

export const ProfileUpdateSchema = z
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

export const MemberUpdateSchema = z
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

export type MemberUpdate = z.infer<typeof MemberUpdateSchema>;

export const memberSelect = {
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

type MemberRecord = Prisma.UserGetPayload<{ select: typeof memberSelect }>;

/**
 * Applies an officer-initiated member record update. Writes an audit entry
 * capturing the previous and new values for every changed field, and
 * notifies the member unless they performed the change themselves.
 *
 * Shared by the members directory editor and the Administrative Actions
 * profile form so both record edits identically.
 */
export async function updateMemberRecord({
  actorId,
  memberId,
  data,
  extraMetadata,
}: {
  actorId: string;
  memberId: string;
  data: MemberUpdate;
  extraMetadata?: Record<string, unknown>;
}) {
  const existing = await prisma.user.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      active: true,
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
        },
      },
    },
  });

  if (!existing) {
    throw new ApiError(404, "Member not found");
  }
  if (data.profile && !existing.applications[0]) {
    throw new ApiError(409, "Member does not have an application profile");
  }

  const previousProfile = existing.applications[0]
    ? {
        fullName: existing.applications[0].fullName,
        age: existing.applications[0].age,
        gender: existing.applications[0].gender,
        address: existing.applications[0].address,
        contact: existing.applications[0].contact,
        farmSize: existing.applications[0].farmSize,
        cropType: existing.applications[0].cropType,
        yearsFarming: existing.applications[0].yearsFarming,
      }
    : null;

  return prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: memberId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.username !== undefined ? { username: data.username } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
      select: memberSelect,
    });

    if (data.profile) {
      await tx.application.update({
        where: { id: existing.applications[0].id },
        data: data.profile,
      });
    }

    await writeAudit(tx, {
      userId: actorId,
      action: "MEMBER_RECORD_UPDATED",
      entity: "User",
      entityId: memberId,
      metadata: {
        ...(extraMetadata ?? {}),
        fields: Object.keys(data),
        previous: {
          name: existing.name,
          username: existing.username,
          role: existing.role,
          active: existing.active,
          profile: previousProfile,
        },
        updated: {
          name: data.name ?? existing.name,
          username: data.username ?? existing.username,
          role: data.role ?? existing.role,
          active: data.active ?? existing.active,
          profile: data.profile ? { ...previousProfile, ...data.profile } : previousProfile,
        },
      },
    });

    if (actorId !== memberId) {
      await notifyUser(tx, {
        userId: memberId,
        title: "Member record updated",
        message:
          "An authorized cooperative officer updated your member record.",
      });
    }

    return tx.user.findUniqueOrThrow({
      where: { id: memberId },
      select: memberSelect,
    });
  });
}

export type { MemberRecord };
