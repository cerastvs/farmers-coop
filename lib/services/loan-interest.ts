import { Prisma } from "@/app/generated/prisma";
import prisma from "@/lib/client";
import {
  applyLoanInterest,
  principalFromAmount,
  roundToMoney,
} from "@/lib/loan-math";

export {
  applyLoanInterest,
  principalFromAmount,
  roundToMoney,
};

export const LOAN_INTEREST_SETTING_KEY = "loanInterestRate";
export const DEFAULT_LOAN_INTEREST_RATE = 2;

export async function getLoanInterestRate(
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number> {
  const row = await tx.coopSetting.findUnique({
    where: { key: LOAN_INTEREST_SETTING_KEY },
  });
  const rate = Number(row?.value);
  if (!Number.isFinite(rate) || rate < 0) {
    return DEFAULT_LOAN_INTEREST_RATE;
  }
  return roundToMoney(rate);
}