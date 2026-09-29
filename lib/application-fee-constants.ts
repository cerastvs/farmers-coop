/**
 * Domain constants for the membership application review.
 *
 * These live apart from `lib/application-fee.ts` so client components can
 * import them without pulling in that module's server-only dependencies.
 *
 * `lib/application-fee.ts` re-exports the multipart/proof helpers, which import
 * `node:fs/promises` to write uploaded files to disk. A "use client" component
 * importing a constant from that module drags `node:fs` into the browser
 * bundle, and the production build fails with "the chunking context does not
 * support external modules". Keeping the shared vocabulary here means the UI
 * and the validation schema read the same list without crossing the
 * client/server boundary.
 */

export const APPLICATION_DENIAL_REASONS = [
  "Incomplete application",
  "Invalid information",
  "Does not meet membership requirements",
  "Required documents missing",
  "Application information could not be verified",
  "Other",
] as const;

export type ApplicationDenialReason =
  (typeof APPLICATION_DENIAL_REASONS)[number];
