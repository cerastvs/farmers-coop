import type { Prisma } from "@/app/generated/prisma";

export function roundToMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function applyLoanInterest(
  principal: number | Prisma.Decimal,
  ratePercent: number,
): number {
  const principalAmount = Number(principal);
  return roundToMoney(principalAmount * (1 + ratePercent / 100));
}

// Inverse of applyLoanInterest: recovers the original principal from a stored
// payable for legacy loans that predate the principalAmount field.
export function principalFromAmount(
  payable: number | Prisma.Decimal,
  ratePercent: number,
): number {
  const payableAmount = Number(payable);
  if (!Number.isFinite(ratePercent) || ratePercent < 0) return payableAmount;
  return roundToMoney(payableAmount / (1 + ratePercent / 100));
}