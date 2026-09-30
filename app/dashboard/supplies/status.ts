/**
 * How a supply request reads to the member, which is not the stored status.
 *
 * A request an officer has approved but the member has not yet collected is,
 * from the member's side, still pending: nothing has been handed over yet. The
 * internal APPROVED state is kept because the officers' queue depends on it,
 * because approval is what reserves the stock, and because the pickup step is
 * what moves a request to COMPLETED. Only the member-facing label changes.
 */
const LABELS: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Pending",
  REJECTED: "Rejected",
  COMPLETED: "Picked up",
};

const STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-amber-100 text-amber-700",
  REJECTED: "bg-red-100 text-red-700",
  COMPLETED: "bg-green-100 text-green-700",
};

const FALLBACK_STYLE = "bg-gray-100 text-gray-700";

export function supplyStatusLabel(status: string): string {
  return LABELS[status] ?? status;
}

export function supplyStatusClass(status: string): string {
  return STYLES[status] ?? FALLBACK_STYLE;
}
