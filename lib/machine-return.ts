/**
 * What a machine return is recorded as when the officer leaves the condition
 * box blank.
 *
 * Kept in its own module, free of Prisma imports, because both the server
 * (which records the return) and the client (which prompts for it) need the
 * exact same wording. If the two disagreed, the officer would be shown one
 * default and the report would show another. lib/lifecycles.ts re-exports
 * these for server callers already importing from there.
 *
 * The box is optional on purpose: most returns are uneventful, and forcing an
 * officer to type "fine" every time trains them to type whatever gets them past
 * the prompt fastest. A blank box is not a missing record, it is the ordinary
 * case, so it is stored as this text. The value is written at the moment of
 * return and never recomputed, so changing the wording later cannot rewrite
 * what a past return actually said.
 */
export const DEFAULT_RETURN_CONDITION_NOTE = "Returned in good condition";

/**
 * The condition to record for a return. A blank or whitespace-only note means
 * the officer saw nothing to flag, which is the good-condition default; any
 * real text is kept verbatim and flagged as an issue.
 */
export function resolveReturnCondition(note: string | null | undefined): {
  note: string;
  hasIssue: boolean;
} {
  const trimmed = (note ?? "").trim();
  if (!trimmed) {
    return { note: DEFAULT_RETURN_CONDITION_NOTE, hasIssue: false };
  }
  return { note: trimmed, hasIssue: true };
}

/**
 * The condition to display for a stored request, for report tables.
 *
 * A request only has a condition once the machine has actually come back, so
 * anything still out shows a dash rather than implying it was inspected.
 * Returns predating this feature have no note stored and fall back to the
 * good-condition wording, which is the reading those rows already carried.
 */
export function returnConditionText(row: {
  returnedAt?: unknown;
  returnNote?: unknown;
}): string {
  if (!row.returnedAt) return "—";
  const note = typeof row.returnNote === "string" ? row.returnNote.trim() : "";
  return note || DEFAULT_RETURN_CONDITION_NOTE;
}
