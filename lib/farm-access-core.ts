import { FarmOwnership } from "@/app/generated/prisma";

/**
 * What a member's role on a farm allows, and what their farm size is for.
 *
 * The three questions in the app all come back to one fact. Hectares are a
 * per-hectare unit: one hectare buys one machine-day, and a supply may cap
 * loans at N units per hectare. A farm worker does not farm their own land, so
 * they have no hectares to spend and no per-hectare basis to divide by. They
 * are not penalised for that — they simply do not get the per-hectare
 * allowances, and the supplies that depend on one are not offered to them.
 */

/** Only a farm worker is treated as having no land of their own. */
export function isFarmWorker(
  farmOwnership: FarmOwnership | null | undefined,
): boolean {
  return farmOwnership === FarmOwnership.FARM_WORKER;
}

/**
 * Whether a farm size means anything for this member.
 *
 * True for a farm owner, and for "Others" (a caretaker or similar), who may
 * well be describing land they work. False for a farm worker.
 */
export function farmSizeApplies(
  farmOwnership: FarmOwnership | null | undefined,
): boolean {
  return !isFarmWorker(farmOwnership);
}

/**
 * The member's farm size when it can be used as a per-hectare basis, else null.
 *
 * Returning the number rather than a boolean lets callers narrow the type, so
 * `Math.floor(farmSize * limit)` is safe after a null check.
 */
export function hectareBasis(
  farmOwnership: FarmOwnership | null | undefined,
  farmSize: number | null | undefined,
): number | null {
  if (!farmSizeApplies(farmOwnership)) return null;
  if (typeof farmSize !== "number" || !Number.isFinite(farmSize)) return null;
  return farmSize > 0 ? farmSize : null;
}

/**
 * Whether the member has a farm size usable as a per-hectare basis.
 *
 * Being a farm owner is not enough on its own: the field is optional, so an
 * owner may legitimately have left it blank. There is nothing to divide by in
 * that case either.
 */
export function hasHectareBasis(
  farmOwnership: FarmOwnership | null | undefined,
  farmSize: number | null | undefined,
): boolean {
  return hectareBasis(farmOwnership, farmSize) !== null;
}

/**
 * Machine borrowing is for the member's own land. A farm worker has none, so
 * they cannot borrow machines regardless of their farm size.
 */
export function canBorrowMachines(
  farmOwnership: FarmOwnership | null | undefined,
): boolean {
  return !isFarmWorker(farmOwnership);
}

/**
 * Whether a member can take on a supply that caps loans per hectare.
 *
 * The cap is optional per supply. A supply without one has no per-hectare
 * basis and stays available to everyone, farm worker or not. A supply with one
 * needs a farm size, and is withheld from a member who has none.
 */
export function canUseSupply(
  loanLimitPerHectare: number | null | undefined,
  hasHectares: boolean,
): boolean {
  return loanLimitPerHectare == null || hasHectares;
}

/**
 * A farm size the member typed in, or null when they left it blank.
 *
 * Kept separate from the schema so that a blank optional field is a real value
 * (null) rather than a validation error or a silent zero.
 */
export function parseFarmSize(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (text === "") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : Number.NaN;
}

/**
 * Whether submitting `nextFarmSize` is a change the member is asking for
 * review, rather than leaving the current value alone.
 *
 * The old value keeps granting its allowance while this is pending, so a
 * member who submits the number already on file has not asked for anything.
 */
export function needsFarmSizeReview(
  currentFarmSize: number | null | undefined,
  nextFarmSize: number | null | undefined,
): boolean {
  if (nextFarmSize == null || Number.isNaN(nextFarmSize)) return false;
  if (currentFarmSize == null) return true;
  return currentFarmSize !== nextFarmSize;
}

interface FarmProfile {
  farmSize: number | null | undefined;
  farmOwnership: FarmOwnership | null | undefined;
  farmOwnershipDetails: string | null | undefined;
}

function normalizedOwnershipDetails(profile: FarmProfile): string | null {
  if (profile.farmOwnership !== FarmOwnership.OTHERS) return null;
  const details = profile.farmOwnershipDetails?.trim();
  return details || null;
}

/** Whether a member's submitted farm details require an officer's approval. */
export function needsFarmProfileReview(
  current: FarmProfile,
  next: FarmProfile,
): boolean {
  return (
    current.farmOwnership !== next.farmOwnership ||
    normalizedOwnershipDetails(current) !== normalizedOwnershipDetails(next) ||
    current.farmSize !== next.farmSize
  );
}
