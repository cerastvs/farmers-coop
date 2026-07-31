import { z } from "zod";

import { EntrySource, EntryType, InitiatedBy } from "@/app/generated/prisma";
import { ManualContext } from "@/lib/services/entry-context";

export const OfficeActionSchema = z
  .object({
    memberId: z.string().uuid(),
    source: z.nativeEnum(EntrySource).default(EntrySource.OFFICE),
    remarks: z.string().trim().max(500).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export function officeManualContext(
  base: z.infer<typeof OfficeActionSchema>,
): ManualContext {
  return {
    entryType: EntryType.MANUAL,
    initiatedBy: InitiatedBy.SECRETARY,
    source: base.source,
    remarks: base.remarks,
    reason: base.reason,
  };
}
