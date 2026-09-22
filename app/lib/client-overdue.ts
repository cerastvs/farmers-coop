export function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export interface MachineRequestShape {
  status: string;
  endDate: string | null;
  returnedAt: string | null;
}

export function machineRequestOverdueDays(
  endDate: string | null | undefined,
  returnedAt: string | null | undefined,
  now: Date = new Date(),
): number {
  if (!endDate || returnedAt) return 0;
  const days = daysBetween(new Date(endDate), now);
  return days > 0 ? days : 0;
}

export function isMachineRequestOverdue(
  status: string,
  endDate: string | null | undefined,
  returnedAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  return !returnedAt && machineRequestOverdueDays(endDate, returnedAt, now) > 0;
}

export function machineActiveOverdueDays(
  requests: MachineRequestShape[] | undefined,
  now: Date = new Date(),
): number {
  if (!requests) return 0;
  let max = 0;
  for (const r of requests) {
    if (isMachineRequestOverdue(r.status, r.endDate, r.returnedAt, now)) {
      const d = machineRequestOverdueDays(r.endDate, r.returnedAt, now);
      if (d > max) max = d;
    }
  }
  return max;
}

export const machineOverdueDays = machineActiveOverdueDays;

export function loanOverdueDays(
  due: string | null | undefined,
  now: Date = new Date(),
): number {
  if (!due) return 0;
  const days = daysBetween(new Date(due), now);
  return days > 0 ? days : 0;
}

export function isLoanOverdue(
  status: string,
  due: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (status === "REJECTED" || status === "PAID") return false;
  return loanOverdueDays(due, now) > 0;
}
