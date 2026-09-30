/**
 * Whether the member may submit a new cash loan.
 *
 * Cash and supply obligations are separate accounts, and a member may hold
 * both at once, so nothing about an open supply loan may gate a cash
 * application. This logic is extracted rather than inlined in the page so it
 * can be tested directly: it is the same mistake the server-side duplicate
 * guard used to make, and the version on the server had a test after the fact
 * rather than before.
 */

export interface OpenLoanLike {
  type?: string | null;
  status?: string | null;
}

const OPEN_STATUSES = ["PENDING", "ACTIVE"];

/**
 * True when the member already has a cash loan that is pending or active.
 *
 * Supply loans are ignored on purpose. The previous version of this check
 * counted every open loan of any type, so a member holding supplies could
 * never use the cash form.
 */
export function hasOpenCashLoan(loans: OpenLoanLike[]): boolean {
  return loans.some(
    (loan) =>
      loan.type === "MONEY" && OPEN_STATUSES.includes(String(loan.status)),
  );
}

/**
 * The balance that counts against a new cash loan.
 *
 * Supply debt is returned separately so the member can be told what they owe
 * without being told they are blocked by it.
 */
export function cashLoanBalance(debt: {
  cash: number;
  supply: number;
}): { balance: number; supplyBalance: number } {
  return { balance: debt.cash, supplyBalance: debt.supply };
}
