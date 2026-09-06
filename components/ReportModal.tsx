"use client";

import { useMemo, isValidElement, type ReactNode } from "react";
import { X } from "lucide-react";
import { Money } from "@/components/Money";

type ReportData = Record<string, unknown>;

export function ReportModal({
  report,
  onClose,
}: {
  report: {
    id: string;
    title: string;
    type: string;
    from?: string | null;
    to?: string | null;
    createdAt: string;
    data: ReportData | null;
  };
  onClose: () => void;
}) {
  const { title, type, from, to, createdAt, data } = report;

  const summary = useMemo(() => {
    if (!data || typeof data !== "object") return null;
    return data as ReportData;
  }, [data]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#eef2e8] bg-[#f7faf5] px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">
              {type} Report
            </p>
            <h2 className="text-lg font-bold text-[#173a2b]">{title}</h2>
            {from || to ? (
              <p className="mt-0.5 text-xs font-semibold text-indigo-600">
                {formatDateRange(from ?? null, to ?? null)}
              </p>
            ) : null}
            {createdAt && (
              <p className="text-xs text-[#718176]">
                Generated {new Date(createdAt).toLocaleString("en-PH")}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close report"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!summary ? (
            <p className="text-sm text-[#718176]">No report data.</p>
          ) : (
            <ReportContent type={type} data={summary} />
          )}
        </div>
      </div>
    </div>
  );
}

type ReportContentProps = {
  type: string;
  data: ReportData;
};

export function ReportContent({ type, data }: ReportContentProps) {
  return <ReportBody type={type} data={data} />;
}

const EMPTY_STATUS: Record<string, number> = {};

function statCards(
  groups: { label: string; byStatus?: Record<string, number> }[],
) {
  return groups.map((group) => {
    const by = group.byStatus ?? EMPTY_STATUS;
    const entries = Object.entries(by);
    if (entries.length === 0) return null;
    return (
      <div
        key={group.label}
        className="rounded-xl border border-[#dce5d9] bg-[#fafdf7] p-3"
      >
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#718176]">
          {group.label}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {entries.map(([status, count]) => (
            <span
              key={status}
              className="flex items-baseline gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5"
            >
              <span className="text-sm font-black text-[#173a2b]">{count}</span>
              <span className="text-[11px] font-semibold lowercase text-[#496558]">
                {humanize(status)}
              </span>
            </span>
          ))}
        </div>
      </div>
    );
  });
}

function renderValue(v: unknown): ReactNode {
  if (v === null || v === undefined || v === "") return "—";
  if (isValidElement(v)) return v;
  return String(v);
}

function humanize(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function kvCard(label: string, value: unknown) {
  return (
    <div className="rounded-xl border border-[#dce5d9] bg-[#fafdf7] p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#718176]">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-[#173a2b]">{renderValue(value)}</p>
    </div>
  );
}

function money(n: unknown) {
  const num = Number(n);
  return Number.isFinite(num) ? <Money value={num} /> : "—";
}

function unitsCard(label: string, primary: string, secondary: ReactNode) {
  return (
    <div className="rounded-xl border border-[#dce5d9] bg-[#fafdf7] p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#718176]">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-[#173a2b]">{primary}</p>
      <p className="text-xs font-semibold text-[#496558]">{secondary}</p>
    </div>
  );
}

function formatDateRange(from: string | null, to: string | null): string | null {
  if (!from && !to) return null;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const yearOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  if (from && to) {
    const d1 = new Date(from);
    const d2 = new Date(to);
    if (d1.getFullYear() === d2.getFullYear()) {
      return `${d1.toLocaleDateString("en-US", opts)} – ${d2.toLocaleDateString("en-US", yearOpts)}`;
    }
    return `${d1.toLocaleDateString("en-US", yearOpts)} – ${d2.toLocaleDateString("en-US", yearOpts)}`;
  }
  if (from) return `From ${new Date(from).toLocaleDateString("en-US", yearOpts)}`;
  return `Until ${new Date(to!).toLocaleDateString("en-US", yearOpts)}`;
}

function Table({
  head,
  rows,
  fallback,
}: {
  head: string[];
  rows: (string | ReactNode)[][];
  fallback: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-[#718176]">{fallback}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-[#eef2e8]">
      <table className="w-full min-w-max text-left text-xs">
        <thead className="bg-[#f0f5ec] text-[11px] font-bold uppercase tracking-wide text-[#496558]">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eef2e8]">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-[#315646]">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SummarySection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-[#315646]">
        {label}
      </h3>
      {children}
    </section>
  );
}

function ReportBody({ type, data }: { type: string; data: ReportData }) {
  switch (type) {
    case "SUMMARY": {
      const loans = (data.loans ?? {}) as ReportData;
      const payments = (data.payments ?? {}) as ReportData;
      const supplies = (data.supplies ?? {}) as ReportData;
      const machines = (data.machines ?? {}) as ReportData;
      const members = (data.members ?? {}) as ReportData;
      const audit = (data.audit ?? {}) as ReportData;
      const transactions = (data.transactions ?? []) as ReportData[];
      return (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {kvCard("Members", members.users ?? 0)}
            {kvCard("Loans", loans.count ?? 0)}
            {kvCard("Loan Principal", money(loans.principal))}
            {kvCard("Loan Paid", money(loans.amountPaid))}
            {kvCard("Payments", payments.count ?? 0)}
            {kvCard("Submitted Amount", money(payments.submittedAmount))}
            {kvCard("Supply Products", supplies.products ?? 0)}
            {kvCard("Units in Stock", supplies.unitsInStock ?? 0)}
            {kvCard("Inventory Value", money(supplies.inventoryValue))}
            {kvCard("Machines", machines.count ?? 0)}
            {kvCard("Machine Requests", machines.requests ?? 0)}
            {kvCard("Audit Entries", audit.entries ?? 0)}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {unitsCard("Sold", `${((supplies.sold as ReportData)?.units ?? 0)} units`, money((supplies.sold as ReportData)?.amount))}
            {unitsCard("Borrowed", `${((supplies.borrowed as ReportData)?.units ?? 0)} units`, money((supplies.borrowed as ReportData)?.amount))}
            {unitsCard("Paid Borrowed", `${((supplies.paidBorrowed as ReportData)?.repayments ?? 0)} repayments`, money((supplies.paidBorrowed as ReportData)?.amount))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {statCards([
              { label: "Loans by Status", byStatus: loans.byStatus as Record<string, number> },
              { label: "Payments by Status", byStatus: payments.byStatus as Record<string, number> },
              { label: "Machines by Status", byStatus: machines.requestsByStatus as Record<string, number> },
              { label: "Supply Requests by Status", byStatus: supplies.requestsByStatus as Record<string, number> },
            ])}
          </div>
          {transactions.length > 0 && (
            <SummarySection label={`Recent Transactions (${transactions.length})`}>
              <Table
                head={["Member", "Type", "Method", "Amount", "Status", "Reference", "Date"]}
                rows={transactions.map((t) => {
                  const user = (t.user as ReportData) ?? {};
                  const applicant = (t.applicant as ReportData) ?? {};
                  const name =
                    (user.name as string) ??
                    (applicant.fullName as string) ??
                    "—";
                  return [
                    name,
                    humanize(t.type),
                    humanize(t.paymentMethod),
                    money(t.amount),
                    humanize(t.status),
                    (t.referenceNo as string) || "—",
                    t.createdAt
                      ? new Date(t.createdAt as string).toLocaleDateString("en-PH")
                      : "—",
                  ];
                })}
                fallback="No transactions in this period."
              />
            </SummarySection>
          )}
        </div>
      );
    }

    case "MEMBERS": {
      const totals = (data.totals ?? {}) as ReportData;
      const members = (data.members ?? []) as ReportData[];
      const applications = (data.applications ?? []) as ReportData[];
      return (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kvCard("Users", totals.users ?? 0)}
            {kvCard("Active", totals.active ?? 0)}
            {kvCard("Inactive", totals.inactive ?? 0)}
            {kvCard("Members", members.length)}
          </div>
          {statCards([
            { label: "By Role", byStatus: totals.byRole as Record<string, number> },
            { label: "Applications by Status", byStatus: totals.applicationsByStatus as Record<string, number> },
          ])}
          <SummarySection label={`Members (${members.length})`}>
            <Table
              head={["Name", "Username", "Role", "Active", "Joined"]}
              rows={members.map((m) => [
                (m.name as string) ?? "—",
                (m.username as string) ?? "—",
                (m.role as string) ?? "—",
                m.active ? "Yes" : "No",
                m.createdAt
                  ? new Date(m.createdAt as string).toLocaleDateString("en-PH")
                  : "—",
              ])}
              fallback="No members."
            />
          </SummarySection>
          <SummarySection label={`Applications (${applications.length})`}>
            <Table
              head={["Applicant", "App Status", "Payment", "Decision"]}
              rows={applications.map((a) => [
                (a.applicant as string) ?? "—",
                humanize(a.applicationStatus),
                humanize(a.paymentStatus),
                humanize(a.decision),
              ])}
              fallback="No applications."
            />
          </SummarySection>
        </div>
      );
    }

    case "LOANS": {
      const totals = (data.totals ?? {}) as ReportData;
      const loans = (data.loans ?? []) as ReportData[];
      return (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kvCard("Loans", totals.loans ?? 0)}
            {kvCard("Principal", money(totals.principal))}
            {kvCard("Paid", money(totals.amountPaid))}
            {kvCard("Outstanding", money(totals.outstandingBalance))}
          </div>
          {statCards([
            { label: "Loans by Status", byStatus: totals.byStatus as Record<string, number> },
          ])}
          <SummarySection label={`Loans (${loans.length})`}>
            <Table
              head={["Borrower", "Type", "Amount", "Paid", "Outstanding", "Status", "Due"]}
              rows={loans.map((l) => {
                const borrower = (l.borrower as ReportData) ?? {};
                return [
                  (borrower.name as string) ?? "—",
                  (l.name as string) ?? "—",
                  money(l.amount),
                  money(l.amountPaid),
                  money(l.outstandingBalance),
                  humanize(l.status),
                  l.due
                    ? new Date(l.due as string).toLocaleDateString("en-PH")
                    : "—",
                ];
              })}
              fallback="No loans."
            />
          </SummarySection>
        </div>
      );
    }

    case "PAYMENTS": {
      const totals = (data.totals ?? {}) as ReportData;
      const payments = (data.payments ?? []) as ReportData[];
      return (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kvCard("Payments", totals.payments ?? 0)}
            {kvCard("Submitted", money(totals.submittedAmount))}
            {kvCard("Verified", money(totals.verifiedAmount))}
          </div>
          {statCards([
            { label: "By Status", byStatus: totals.byStatus as Record<string, number> },
            { label: "By Method", byStatus: totals.byMethod as Record<string, number> },
          ])}
          <SummarySection label={`Payments (${payments.length})`}>
            <Table
              head={["Name", "Type", "Method", "Amount", "Status", "Reference", "Date"]}
              rows={payments.map((p) => {
                const user = (p.user as ReportData) ?? {};
                const applicant = (p.applicant as ReportData) ?? {};
                const name =
                  (user.name as string) ??
                  (applicant.fullName as string) ??
                  "—";
                return [
                  name,
                  humanize(p.type),
                  humanize(p.paymentMethod),
                  money(p.amount),
                  <span
                    key="st"
                    className="rounded-full bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700"
                  >
                    {humanize(p.status)}
                  </span>,
                  (p.referenceNo as string) || "—",
                  p.createdAt
                    ? new Date(p.createdAt as string).toLocaleDateString("en-PH")
                    : "—",
                ];
              })}
              fallback="No payments."
            />
          </SummarySection>
        </div>
      );
    }

    case "SUPPLIES": {
      const totals = (data.totals ?? {}) as ReportData;
      const supplies = (data.supplies ?? []) as ReportData[];
      const sold = (totals.sold ?? {}) as ReportData;
      const borrowed = (totals.borrowed ?? {}) as ReportData;
      const paidBorrowed = (totals.paidBorrowed ?? {}) as ReportData;
      return (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kvCard("Products", totals.products ?? 0)}
            {kvCard("Units in Stock", totals.unitsInStock ?? 0)}
            {kvCard("Inventory Value", money(totals.inventoryValue))}
            {kvCard("Requests", totals.requests ?? 0)}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {unitsCard("Sold", `${sold.units ?? 0} units`, money(sold.amount))}
            {unitsCard("Borrowed", `${borrowed.units ?? 0} units`, money(borrowed.amount))}
            {unitsCard("Paid Borrowed", `${paidBorrowed.repayments ?? 0} repayments`, money(paidBorrowed.amount))}
          </div>
          <SummarySection label={`Supplies (${supplies.length})`}>
            <Table
              head={["Product", "Price", "Qty", "Sold", "Borrowed", "Inventory Value"]}
              rows={supplies.map((s) => [
                (s.productName as string) ?? "—",
                money(s.price),
                String(s.quantity ?? "—"),
                String(s.soldUnits ?? "—"),
                String(s.borrowedUnits ?? "—"),
                money(s.inventoryValue),
              ])}
              fallback="No supplies."
            />
          </SummarySection>
        </div>
      );
    }

    case "MACHINES": {
      const totals = (data.totals ?? {}) as ReportData;
      const machines = (data.machines ?? []) as ReportData[];
      return (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {kvCard("Machines", totals.machines ?? 0)}
            {kvCard("Requests", totals.requests ?? 0)}
          </div>
          {statCards([
            { label: "Requests by Status", byStatus: totals.requestsByStatus as Record<string, number> },
          ])}
          <SummarySection label={`Machines (${machines.length})`}>
            {machines.map((m) => {
              const requests = (m.requests ?? []) as ReportData[];
              return (
                <div
                  key={(m.id as string) ?? String(m.name)}
                  className="mb-3 rounded-xl border border-[#eef2e8] bg-[#fafdf7] p-3"
                >
                  <p className="text-sm font-bold text-[#173a2b]">
                    {m.name as string}
                  </p>
                  {(m.description as string) && (
                    <p className="text-xs text-[#718176]">
                      {m.description as string}
                    </p>
                  )}
                  {requests.length > 0 && (
                    <div className="mt-2">
                      <Table
                        head={["Member", "Status", "Start", "End"]}
                        rows={requests.map((r) => {
                          const user = (r.user as ReportData) ?? {};
                          return [
                            (user.name as string) ?? "—",
                            humanize(r.status),
                            r.startDate
                              ? new Date(r.startDate as string).toLocaleDateString("en-PH")
                              : "—",
                            r.endDate
                              ? new Date(r.endDate as string).toLocaleDateString("en-PH")
                              : "—",
                          ];
                        })}
                        fallback=""
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </SummarySection>
        </div>
      );
    }

    case "AUDIT": {
      const totals = (data.totals ?? {}) as ReportData;
      const entries = (data.entries ?? []) as ReportData[];
      return (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {kvCard("Entries", totals.entries ?? 0)}
            {kvCard("Limit", totals.limitedToMostRecent ?? "—")}
          </div>
          {statCards([
            { label: "By Action", byStatus: totals.byAction as Record<string, number> },
          ])}
          <SummarySection label={`Audit Entries (${entries.length})`}>
            <Table
              head={["User", "Role", "Action", "Entity", "When"]}
              rows={entries.map((e) => {
                const user = (e.user as ReportData) ?? {};
                return [
                  (user.name as string) ?? "—",
                  humanize(user.role),
                  humanize(e.action),
                  (e.entity as string) ?? "—",
                  e.createdAt
                    ? new Date(e.createdAt as string).toLocaleString("en-PH")
                    : "—",
                ];
              })}
              fallback="No audit entries."
            />
          </SummarySection>
        </div>
      );
    }

    default:
      return <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(data, null, 2)}</pre>;
  }
}
