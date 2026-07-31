import { z } from "zod";

import {
  EntrySource,
  EntryType,
  InitiatedBy,
  Prisma,
  Role,
} from "@/app/generated/prisma";

export const ManualContextSchema = z
  .object({
    entryType: z.nativeEnum(EntryType).default(EntryType.ONLINE),
    initiatedBy: z.nativeEnum(InitiatedBy).default(InitiatedBy.MEMBER),
    source: z.nativeEnum(EntrySource).default(EntrySource.PORTAL),
    remarks: z.string().trim().max(500).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export type ManualContext = z.infer<typeof ManualContextSchema>;

export const ONLINE_CONTEXT: ManualContext = {
  entryType: EntryType.ONLINE,
  initiatedBy: InitiatedBy.MEMBER,
  source: EntrySource.PORTAL,
};

export type ManualCreateData = {
  createdById: string;
  createdByRole: Role;
  entryType: EntryType;
  initiatedBy: InitiatedBy;
  source: EntrySource;
  remarks: string | null;
};

export function manualCreateData(
  actorId: string,
  actorRole: Role,
  context: ManualContext,
): ManualCreateData {
  return {
    createdById: actorId,
    createdByRole: actorRole,
    entryType: context.entryType,
    initiatedBy: context.initiatedBy,
    source: context.source,
    remarks: context.remarks ?? null,
  };
}

export function auditMetadata(
  context: ManualContext,
  extra?: Record<string, unknown>,
): Prisma.InputJsonValue {
  return {
    ...(extra ?? {}),
    manualContext: {
      entryType: context.entryType,
      initiatedBy: context.initiatedBy,
      source: context.source,
      remarks: context.remarks,
      reason: context.reason,
    },
  };
}
