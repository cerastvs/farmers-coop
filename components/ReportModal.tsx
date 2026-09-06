"use client";

import { useMemo, useState, isValidElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
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

function kvCard(label: string, value: unknown, onClick?: () => void) {
  return (
    <div
      className={`rounded-xl border border-[#dce5d9] bg-[#fafdf7] p-3${onClick ? " cursor-pointer transition hover:border-indigo-300 hover:bg-indigo-50" : ""}`}
      onClick={onClick}
    >
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

function DetailModal({
  detail,
  onClose,
}: {
  detail: { title: string; columns: string[]; rows: (string | ReactNode)[][] };
  onClose: () => void;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#eef2e8] bg-[#f7faf5] px-5 py-3">
          <h3 className="text-sm font-bold text-[#173a2b]">{detail.title}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <Table
            head={detail.columns}
            rows={detail.rows}
            fallback="No records found."
          />
        </div>
      </div>
    </div>,
    document.body,
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
  const [detail, setDetail] = useState<{
    title: string;
    columns: string[];
    rows: (string | ReactNode)[][];
  } | null>(null);

  function showDetail(
    title: string,
    columns: string[],
    rows: (string | ReactNode)[][],
  ) {
    setDetail({ title, columns, rows });
  }

  const content = (() => {
    switch (type) {
      case "SUMMARY": {
        const loans = (data.loans ?? {}) as ReportData;
        const payments = (data.payments ?? {}) as ReportData;
        const supplies = (data.supplies ?? {}) as ReportData;
        const machines = (data.machines ?? {}) as ReportData;
        const members = (data.members ?? {}) as ReportData;
        const audit = (data.audit ?? {}) as ReportData;
        const transactions = (data.transactions ?? []) as ReportData[];
        const memberList = (members.list ?? []) as ReportData[];
        const loanList = (loans.list ?? []) as ReportData[];
        const paymentList = (payments.list ?? []) as ReportData[];
        const supplyList = (supplies.list ?? []) as ReportData[];
        const machineList = (machines.list ?? []) as ReportData[];
        const machineReqList = (machines.requestsList ?? []) as ReportData[];
        const auditList = (audit.list ?? []) as ReportData[];
        const loanCols = ["Name", "Amount", "Paid", "Outstanding", "Status", "Due"];
        const loanRows = loanList.map((l) => {
          const u = (l.user ?? {}) as ReportData;
          return [
            (u.name as string) ?? "—",
            money(l.amount),
            money(l.amountPaid),
            money(l.outstandingBalance),
            humanize(l.status),
            l.due ? new Date(l.due as string).toLocaleDateString("en-PH") : "—",
          ];
        });
        const payCols = ["Name", "Type", "Method", "Amount", "Status", "Date"];
        const payRows = paymentList.map((p) => {
          const u = (p.user ?? {}) as ReportData;
          const a = (p.applicant ?? {}) as ReportData;
          return [
            (u.name as string) ?? (a.fullName as string) ?? "—",
            humanize(p.type),
            humanize(p.paymentMethod),
            money(p.amount),
            humanize(p.status),
            p.createdAt ? new Date(p.createdAt as string).toLocaleDateString("en-PH") : "—",
          ];
        });
        const supplyCols = ["Product", "Price", "Qty", "Inventory Value"];
        const supplyRows = supplyList.map((s) => [
          (s.productName as string) ?? "—",
          money(s.price),
          String(s.quantity ?? "—"),
          money(s.inventoryValue),
        ]);
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {kvCard("Members", members.users ?? 0, memberList.length ? () => showDetail("Members", ["Name", "Username", "Role", "Active"], memberList.map((m) => [(m.name as string) ?? "—", (m.username as string) ?? "—", humanize(m.role), m.active ? "Yes" : "No"])) : undefined)}
              {kvCard("Loans", loans.count ?? 0, loanList.length ? () => showDetail("Loans", loanCols, loanRows) : undefined)}
              {kvCard("Loan Principal", money(loans.principal), loanList.length ? () => showDetail("Loan Principal", loanCols, loanRows) : undefined)}
              {kvCard("Loan Paid", money(loans.amountPaid), loanList.length ? () => showDetail("Loan Repayments", ["Name", "Amount Paid", "Status"], loanList.filter((l) => Number(l.amountPaid) > 0).map((l) => { const u = (l.user ?? {}) as ReportData; return [(u.name as string) ?? "—", money(l.amountPaid), humanize(l.status)]; })) : undefined)}
              {kvCard("Payments", payments.count ?? 0, paymentList.length ? () => showDetail("Payments", payCols, payRows) : undefined)}
              {kvCard("Submitted Amount", money(payments.submittedAmount), paymentList.length ? () => showDetail("Submitted Payments", payCols, payRows) : undefined)}
              {kvCard("Supply Products", supplies.products ?? 0, supplyList.length ? () => showDetail("Supply Products", supplyCols, supplyRows) : undefined)}
              {kvCard("Units in Stock", supplies.unitsInStock ?? 0, supplyList.length ? () => showDetail("Supply Inventory", supplyCols, supplyRows) : undefined)}
              {kvCard("Inventory Value", money(supplies.inventoryValue), supplyList.length ? () => showDetail("Inventory Value", supplyCols, supplyRows) : undefined)}
              {kvCard("Machines", machines.count ?? 0, machineList.length ? () => showDetail("Machines", ["Machine", "Description"], machineList.map((m) => [(m.name as string) ?? "—", (m.description as string) ?? "—"])) : undefined)}
              {kvCard("Machine Requests", machines.requests ?? 0, machineReqList.length ? () => showDetail("Machine Requests", ["Machine", "Member", "Status"], machineReqList.map((r) => { const m = (r.machine ?? {}) as ReportData; const u = (r.user ?? {}) as ReportData; return [(m.name as string) ?? "—", (u.name as string) ?? "—", humanize(r.status)]; })) : undefined)}
              {kvCard("Audit Entries", audit.entries ?? 0, auditList.length ? () => showDetail("Audit Entries", ["User", "Action", "Entity", "When"], auditList.map((e) => { const u = (e.user ?? {}) as ReportData; return [(u.name as string) ?? "—", humanize(e.action), (e.entity as string) ?? "—", e.createdAt ? new Date(e.createdAt as string).toLocaleString("en-PH") : "—"]; })) : undefined)}
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
                    const name = (user.name as string) ?? (applicant.fullName as string) ?? "—";
                    return [name, humanize(t.type), humanize(t.paymentMethod), money(t.amount), humanize(t.status), (t.referenceNo as string) || "—", t.createdAt ? new Date(t.createdAt as string).toLocaleDateString("en-PH") : "—"];
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
        const memberCols = ["Name", "Username", "Role", "Active", "Joined"];
        const memberRows = members.map((m) => [(m.name as string) ?? "—", (m.username as string) ?? "—", (m.role as string) ?? "—", m.active ? "Yes" : "No", m.createdAt ? new Date(m.createdAt as string).toLocaleDateString("en-PH") : "—"]);
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {kvCard("Users", totals.users ?? 0, () => showDetail("All Users", memberCols, memberRows))}
              {kvCard("Active", totals.active ?? 0, () => showDetail("Active Users", memberCols, members.filter((m) => m.active).map((m) => [(m.name as string) ?? "—", (m.username as string) ?? "—", (m.role as string) ?? "—", "Yes", m.createdAt ? new Date(m.createdAt as string).toLocaleDateString("en-PH") : "—"])))}
              {kvCard("Inactive", totals.inactive ?? 0, () => showDetail("Inactive Users", memberCols, members.filter((m) => !m.active).map((m) => [(m.name as string) ?? "—", (m.username as string) ?? "—", (m.role as string) ?? "—", "No", m.createdAt ? new Date(m.createdAt as string).toLocaleDateString("en-PH") : "—"])))}
              {kvCard("Members", members.length, () => showDetail("Members", memberCols, memberRows))}
            </div>
            {statCards([
              { label: "By Role", byStatus: totals.byRole as Record<string, number> },
              { label: "Applications by Status", byStatus: totals.applicationsByStatus as Record<string, number> },
            ])}
            <SummarySection label={`Members (${members.length})`}>
              <Table head={memberCols} rows={memberRows} fallback="No members." />
            </SummarySection>
            <SummarySection label={`Applications (${applications.length})`}>
              <Table head={["Applicant", "App Status", "Payment", "Decision"]} rows={applications.map((a) => [(a.applicant as string) ?? "—", humanize(a.applicationStatus), humanize(a.paymentStatus), humanize(a.decision)])} fallback="No applications." />
            </SummarySection>
          </div>
        );
      }

      case "LOANS": {
        const totals = (data.totals ?? {}) as ReportData;
        const loans = (data.loans ?? []) as ReportData[];
        const loanCols = ["Borrower", "Type", "Amount", "Paid", "Outstanding", "Status", "Due"];
        const loanRows = loans.map((l) => { const b = (l.borrower ?? {}) as ReportData; return [(b.name as string) ?? "—", (l.name as string) ?? "—", money(l.amount), money(l.amountPaid), money(l.outstandingBalance), humanize(l.status), l.due ? new Date(l.due as string).toLocaleDateString("en-PH") : "—"]; });
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {kvCard("Loans", totals.loans ?? 0, () => showDetail("All Loans", loanCols, loanRows))}
              {kvCard("Principal", money(totals.principal), () => showDetail("Loan Principal", loanCols, loanRows))}
              {kvCard("Paid", money(totals.amountPaid), () => showDetail("Loan Repayments", ["Borrower", "Amount", "Paid", "Status"], loans.filter((l) => Number(l.amountPaid) > 0).map((l) => { const b = (l.borrower ?? {}) as ReportData; return [(b.name as string) ?? "—", money(l.amount), money(l.amountPaid), humanize(l.status)]; })))}
              {kvCard("Outstanding", money(totals.outstandingBalance), () => showDetail("Outstanding Balances", ["Borrower", "Amount", "Outstanding", "Status"], loans.filter((l) => Number(l.outstandingBalance) > 0).map((l) => { const b = (l.borrower ?? {}) as ReportData; return [(b.name as string) ?? "—", money(l.amount), money(l.outstandingBalance), humanize(l.status)]; })))}
            </div>
            {statCards([{ label: "Loans by Status", byStatus: totals.byStatus as Record<string, number> }])}
            <SummarySection label={`Loans (${loans.length})`}>
              <Table head={loanCols} rows={loanRows} fallback="No loans." />
            </SummarySection>
          </div>
        );
      }

      case "PAYMENTS": {
        const totals = (data.totals ?? {}) as ReportData;
        const payments = (data.payments ?? []) as ReportData[];
        const payCols = ["Name", "Type", "Method", "Amount", "Status", "Reference", "Date"];
        const payRows = payments.map((p) => { const u = (p.user as ReportData) ?? {}; const a = (p.applicant as ReportData) ?? {}; return [(u.name as string) ?? (a.fullName as string) ?? "—", humanize(p.type), humanize(p.paymentMethod), money(p.amount), humanize(p.status), (p.referenceNo as string) || "—", p.createdAt ? new Date(p.createdAt as string).toLocaleDateString("en-PH") : "—"]; });
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {kvCard("Payments", totals.payments ?? 0, () => showDetail("All Payments", payCols, payRows))}
              {kvCard("Submitted", money(totals.submittedAmount), () => showDetail("Submitted Payments", payCols, payRows))}
              {kvCard("Verified", money(totals.verifiedAmount), () => showDetail("Verified Payments", payCols, payments.filter((p) => p.status === "VERIFIED").map((p) => { const u = (p.user as ReportData) ?? {}; const a = (p.applicant as ReportData) ?? {}; return [(u.name as string) ?? (a.fullName as string) ?? "—", humanize(p.type), humanize(p.paymentMethod), money(p.amount), "Verified", (p.referenceNo as string) || "—", p.createdAt ? new Date(p.createdAt as string).toLocaleDateString("en-PH") : "—"]; })))}
            </div>
            {statCards([
              { label: "By Status", byStatus: totals.byStatus as Record<string, number> },
              { label: "By Method", byStatus: totals.byMethod as Record<string, number> },
            ])}
            <SummarySection label={`Payments (${payments.length})`}>
              <Table head={payCols} rows={payRows.map((r) => [...r.slice(0, 4), <span key="st" className="rounded-full bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700">{r[4]}</span>, ...r.slice(5)])} fallback="No payments." />
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
        const supplyCols = ["Product", "Price", "Qty", "Sold", "Borrowed", "Inventory Value"];
        const supplyRows = supplies.map((s) => [(s.productName as string) ?? "—", money(s.price), String(s.quantity ?? "—"), String(s.soldUnits ?? "—"), String(s.borrowedUnits ?? "—"), money(s.inventoryValue)]);
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {kvCard("Products", totals.products ?? 0, () => showDetail("Supply Products", supplyCols, supplyRows))}
              {kvCard("Units in Stock", totals.unitsInStock ?? 0, () => showDetail("Supply Inventory", supplyCols, supplyRows))}
              {kvCard("Inventory Value", money(totals.inventoryValue), () => showDetail("Inventory Value", ["Product", "Price", "Qty", "Value"], supplies.map((s) => [(s.productName as string) ?? "—", money(s.price), String(s.quantity ?? "—"), money(s.inventoryValue)])))}
              {kvCard("Requests", totals.requests ?? 0, () => showDetail("Supply Requests", supplyCols, supplyRows))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {unitsCard("Sold", `${sold.units ?? 0} units`, money(sold.amount))}
              {unitsCard("Borrowed", `${borrowed.units ?? 0} units`, money(borrowed.amount))}
              {unitsCard("Paid Borrowed", `${paidBorrowed.repayments ?? 0} repayments`, money(paidBorrowed.amount))}
            </div>
            <SummarySection label={`Supplies (${supplies.length})`}>
              <Table head={supplyCols} rows={supplyRows} fallback="No supplies." />
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
              {kvCard("Machines", totals.machines ?? 0, () => showDetail("Machines", ["Machine", "Description"], machines.map((m) => [(m.name as string) ?? "—", (m.description as string) ?? "—"])))}
              {kvCard("Requests", totals.requests ?? 0, () => showDetail("Machine Requests", ["Machine", "Member", "Status", "Start", "End"], machines.flatMap((m) => ((m.requests ?? []) as ReportData[]).map((r) => { const u = (r.user as ReportData) ?? {}; return [(m.name as string) ?? "—", (u.name as string) ?? "—", humanize(r.status), r.startDate ? new Date(r.startDate as string).toLocaleDateString("en-PH") : "—", r.endDate ? new Date(r.endDate as string).toLocaleDateString("en-PH") : "—"]; }))))}
            </div>
            {statCards([{ label: "Requests by Status", byStatus: totals.requestsByStatus as Record<string, number> }])}
            <SummarySection label={`Machines (${machines.length})`}>
              {machines.map((m) => {
                const requests = (m.requests ?? []) as ReportData[];
                return (
                  <div key={(m.id as string) ?? String(m.name)} className="mb-3 rounded-xl border border-[#eef2e8] bg-[#fafdf7] p-3">
                    <p className="text-sm font-bold text-[#173a2b]">{m.name as string}</p>
                    {(m.description as string) && <p className="text-xs text-[#718176]">{m.description as string}</p>}
                    {requests.length > 0 && (
                      <div className="mt-2">
                        <Table head={["Member", "Status", "Start", "End"]} rows={requests.map((r) => { const user = (r.user as ReportData) ?? {}; return [(user.name as string) ?? "—", humanize(r.status), r.startDate ? new Date(r.startDate as string).toLocaleDateString("en-PH") : "—", r.endDate ? new Date(r.endDate as string).toLocaleDateString("en-PH") : "—"]; })} fallback="" />
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
        const auditCols = ["User", "Role", "Action", "Entity", "When"];
        const auditRows = entries.map((e) => { const u = (e.user as ReportData) ?? {}; return [(u.name as string) ?? "—", humanize(u.role), humanize(e.action), (e.entity as string) ?? "—", e.createdAt ? new Date(e.createdAt as string).toLocaleString("en-PH") : "—"]; });
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {kvCard("Entries", totals.entries ?? 0, () => showDetail("Audit Entries", auditCols, auditRows))}
              {kvCard("Limit", totals.limitedToMostRecent ?? "—")}
            </div>
            {statCards([{ label: "By Action", byStatus: totals.byAction as Record<string, number> }])}
            <SummarySection label={`Audit Entries (${entries.length})`}>
              <Table head={auditCols} rows={auditRows} fallback="No audit entries." />
            </SummarySection>
          </div>
        );
      }

      default:
        return <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(data, null, 2)}</pre>;
    }
  })();

  return (
    <>
      {content}
      {detail && (
        <DetailModal detail={detail} onClose={() => setDetail(null)} />
      )}
    </>
  );
}
