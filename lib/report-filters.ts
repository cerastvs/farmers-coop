import {
  ApplicationStatus,
  LoanStatus,
  MachineStatus,
  PaymentStatus,
  ReportType,
  Role,
  TransactionStatus,
} from "@/app/generated/prisma";
import { ApiError } from "@/lib/errors";

/**
 * Which enum a report's status filter is drawn from.
 *
 * Reports filter on columns whose types differ per report: the member roster
 * filters on `User.role`, loans on `Loan.status`, and so on. A single shared
 * "statuses" filter across all of them is what caused a filter to be applied
 * against the wrong enum — every value was rejected, the filter silently became
 * empty, and the officer received a full unfiltered report with no indication
 * their selection had been discarded.
 */
const STATUS_DOMAIN_BY_REPORT_TYPE: Partial<
  Record<ReportType, readonly string[]>
> = {
  [ReportType.MEMBERS]: Object.values(Role),
  [ReportType.LOANS]: Object.values(LoanStatus),
  [ReportType.PAYMENTS]: Object.values(PaymentStatus),
  [ReportType.SUPPLIES]: Object.values(TransactionStatus),
  [ReportType.MACHINES]: Object.values(MachineStatus),
};

/**
 * The member roster filters on two unrelated enums, so its two status filters
 * are validated separately: `User.role` is a Role, and `Application.status` is
 * an ApplicationStatus. They are never interchangeable.
 */
export const APPLICATION_STATUS_DOMAIN: readonly string[] =
  Object.values(ApplicationStatus);

/**
 * Narrows a client-supplied status list to the enum this filter actually
 * applies to.
 *
 * Unknown values are rejected with a 400 rather than dropped. Dropping is worse
 * than useless: the filter ends up empty, the query runs unrestricted, and the
 * caller has no way to tell their filter was ignored. A 400 makes the
 * difference visible instead of quietly returning the wrong report.
 *
 * Returns `undefined` when there is nothing to filter on — no filter supplied,
 * or a report type (SUMMARY, AUDIT) that has no status domain.
 *
 * @param domain overrides the report type's default domain; used for the
 * member roster's separate application-status filter.
 */
export function validateStatuses(
  type: ReportType,
  statuses: string[] | undefined,
  domain: readonly string[] = STATUS_DOMAIN_BY_REPORT_TYPE[type] ?? [],
) {
  if (!statuses || statuses.length === 0) return undefined;
  if (domain.length === 0) return undefined;

  const allowed = new Set(domain);
  const invalid = statuses.filter((status) => !allowed.has(status));
  if (invalid.length > 0) {
    throw new ApiError(
      400,
      `Invalid status value for this report: ${invalid.join(", ")}`,
    );
  }
  return statuses;
}
