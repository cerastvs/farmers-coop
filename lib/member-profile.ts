import { FarmOwnership, Prisma, Role } from "@/app/generated/prisma";
import { z } from "zod";

import { notifyUser, writeAudit } from "@/lib/activity";
import { ApiError } from "@/lib/errors";
import prisma from "@/lib/client";
import { toTitleCase } from "@/lib/format";

const cropMachineRequest = z
  .array(z.string().trim().min(1))
  .transform((vals) => vals.map(toTitleCase))
  .optional();

export const ProfileUpdateSchema = z
  .object({
    fullName: z.string().trim().min(3).max(120).transform(toTitleCase).optional(),
    birthDate: z
      .string()
      .refine((val) => !Number.isNaN(Date.parse(val)), {
        message: "Invalid birth date",
      })
      .optional(),
    gender: z.enum(["Male", "Female"]).optional(),
    address: z.string().trim().min(5).max(300).optional(),
    contact: z.string().trim().regex(/^[0-9]{10,15}$/).optional(),
    farmSize: z.coerce.number().positive().optional(),
    yearsFarming: z.coerce.number().int().min(0).max(80).optional(),
    farmOwnership: z.nativeEnum(FarmOwnership).optional(),
    farmOwnershipDetails: z.string().trim().max(300).transform(toTitleCase).optional(),
    cropType: cropMachineRequest,
    farmMachinery: cropMachineRequest,
  })
  .strict();

export const MemberUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .transform(toTitleCase)
      .nullable()
      .optional(),
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
      birthDate: true,
      gender: true,
      address: true,
      contact: true,
      farmSize: true,
      crops: { select: { name: true }, orderBy: { name: "asc" as const } },
      machines: { select: { name: true }, orderBy: { name: "asc" as const } },
      yearsFarming: true,
      farmOwnership: true,
      farmOwnershipDetails: true,
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
          birthDate: true,
          gender: true,
          address: true,
          contact: true,
          farmSize: true,
          crops: { select: { name: true }, orderBy: { name: "asc" } },
          machines: { select: { name: true }, orderBy: { name: "asc" } },
          yearsFarming: true,
          farmOwnership: true,
          farmOwnershipDetails: true,
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
        birthDate: existing.applications[0].birthDate,
        gender: existing.applications[0].gender,
        address: existing.applications[0].address,
        contact: existing.applications[0].contact,
        farmSize: existing.applications[0].farmSize,
        crops: existing.applications[0].crops.map((c) => c.name),
        machines: existing.applications[0].machines.map((m) => m.name),
        yearsFarming: existing.applications[0].yearsFarming,
        farmOwnership: existing.applications[0].farmOwnership,
        farmOwnershipDetails: existing.applications[0].farmOwnershipDetails,
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
      const { cropType, farmMachinery, ...scalarProfile } = data.profile;
      await tx.application.update({
        where: { id: existing.applications[0].id },
        data: {
          ...scalarProfile,
          ...(cropType !== undefined
            ? {
                crops: {
                  deleteMany: {},
                  create: cropType.map((name) => ({ name })),
                },
              }
            : {}),
          ...(farmMachinery !== undefined
            ? {
                machines: {
                  deleteMany: {},
                  create: farmMachinery.map((name) => ({ name })),
                },
              }
            : {}),
        },
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
