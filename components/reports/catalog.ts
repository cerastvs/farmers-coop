"use client";

/* eslint-disable @typescript-eslint/no-explicit-any -- Section definitions
   access deeply-typed report snapshot JSON of unknown shape; the catalog is a
   declarative mapping over that data and benefits from loose row typing. */

import type { ReportData, ReportTypeCatalog } from "./types";
import {
  dateValue,
  humanize,
  money,
  moneyValue,
  renderDate,
  renderDateTime,
} from "./format";

const byStatus = (data: ReportData, key: string): Record<string, number> =>
  (data[key] as Record<string, number>) ?? {};

const paymentAmountFallback = (payments: unknown, statuses: string[]) =>
  ((payments as Record<string, any>[]) ?? []).reduce(
    (sum, payment) =>
      sum + (statuses.includes(payment.status) ? moneyValue(payment.amount) : 0),
    0,
  );

const user = (row: Record<string, any>): Record<string, any> =>
  (row.user as Record<string, any>) ?? {};
const borrower = (row: Record<string, any>): Record<string, any> =>
  (row.borrower as Record<string, any>) ?? {};
const applicant = (row: Record<string, any>): Record<string, any> =>
  (row.applicant as Record<string, any>) ?? {};

const nameOf = (row: Record<string, any>): string =>
  (user(row).name as string) ??
  (borrower(row).name as string) ??
  (applicant(row).fullName as string) ??
  "—";

// ---------------------------------------------------------------- MEMBERS

const MEMBERS: ReportTypeCatalog = {
  type: "MEMBERS",
  label: "Member Records Report",
  memberFilter: true,
  statusOptions: ["APPLICANT", "MEMBER", "TREASURER", "PRESIDENT", "SECRETARY"],
  notes: [
    "Member and application counts reflect records as of the report date range.",
    "Only member roles applicable to cooperative officers are listed.",
  ],
  sections: [
    {
      id: "totals",
      label: "Member Summary",
      kind: "kv",
      kvs: [
        { id: "users", label: "Users", value: (d) => (d.totals?.users ?? 0) },
        { id: "active", label: "Active", value: (d) => (d.totals?.active ?? 0) },
        { id: "inactive", label: "Inactive", value: (d) => (d.totals?.inactive ?? 0) },
        { id: "members", label: "Members", value: (d) => ((d.members as unknown[]) ?? []).length },
      ],
    },
    {
      id: "byRole",
      label: "Members by Role",
      kind: "stat",
      stats: [{ id: "role", label: "By Role", byStatus: (d) => byStatus(d.totals ?? {}, "byRole") }],
    },
    {
      id: "appStatus",
      label: "Applications by Status",
      kind: "stat",
      stats: [
        {
          id: "app",
          label: "Applications by Status",
          byStatus: (d) => byStatus(d.totals ?? {}, "applicationsByStatus"),
        },
      ],
    },
    {
      id: "membersTable",
      label: "Member Records",
      kind: "table",
      table: {
        rows: (d) => ((d.members as unknown[]) ?? []) as Record<string, any>[],
        columns: [
          { id: "name", label: "Name", get: (r) => r.name ?? "", render: (r) => r.name ?? "—" },
          { id: "username", label: "Username", get: (r) => r.username ?? "", render: (r) => r.username ?? "—" },
          { id: "role", label: "Role", get: (r) => r.role ?? "", render: (r) => humanize(r.role) },
          { id: "active", label: "Active", get: (r) => (r.active ? 1 : 0), render: (r) => (r.active ? "Yes" : "No") },
          { id: "joined", label: "Joined", get: (r) => dateValue(r.createdAt), render: (r) => renderDate(r.createdAt) },
        ],
        groupFields: [
          { key: "role", label: "Role", get: (r) => r.role ?? null },
          { key: "active", label: "Active status", get: (r) => (r.active ? "Active" : "Inactive") },
        ],
      },
    },
    {
      id: "applicationsTable",
      label: "Membership Applications",
      kind: "table",
      table: {
        rows: (d) => ((d.applications as unknown[]) ?? []) as Record<string, any>[],
        columns: [
          { id: "applicant", label: "Applicant", get: (r) => r.applicant ?? "", render: (r) => r.applicant ?? "—" },
          { id: "appStatus", label: "Application Status", get: (r) => r.applicationStatus ?? "", render: (r) => humanize(r.applicationStatus) },
          { id: "payment", label: "Payment", get: (r) => r.paymentStatus ?? "", render: (r) => humanize(r.paymentStatus) },
          { id: "decision", label: "Decision", get: (r) => r.decision ?? "", render: (r) => humanize(r.decision) },
        ],
        groupFields: [
          { key: "appStatus", label: "Application status", get: (r) => r.applicationStatus ?? null },
          { key: "decision", label: "Decision", get: (r) => r.decision ?? null },
        ],
      },
    },
  ],
  defaultSections: ["totals", "byRole", "appStatus", "membersTable"],
  presets: {
    summary: { id: "summary", label: "Summary", sections: ["totals", "byRole", "appStatus"] },
    detailed: {
      id: "detailed",
      label: "Detailed",
      sections: ["totals", "byRole", "appStatus", "membersTable"],
    },
    full: {
      id: "full",
      label: "Full Details",
      sections: ["totals", "byRole", "appStatus", "membersTable", "applicationsTable"],
    },
  },
};

// ---------------------------------------------------------------- LOANS

const LOANS: ReportTypeCatalog = {
  type: "LOANS",
  label: "Loan Portfolio Report",
  memberFilter: true,
  statusOptions: ["PENDING", "APPROVED", "ACTIVE", "OVERDUE", "PAID", "REJECTED"],
  notes: [
    "Rejected loan requests are excluded from principal, paid, and outstanding totals.",
    "Outstanding balances reflect total payments to date for loans in the selected period.",
    "Rejected loan-payment submissions are reported separately and are not included in paid totals.",
  ],
  sections: [
    {
      id: "totals",
      label: "Loan Portfolio",
      kind: "kv",
      kvs: [
        { id: "loans", label: "Loans", value: (d) => (d.totals?.loans ?? 0) },
        { id: "principal", label: "Principal", value: (d) => money(d.totals?.principal) },
        { id: "paid", label: "Loan Paid", value: (d) => money(d.totals?.amountPaid) },
        { id: "outstanding", label: "Outstanding", value: (d) => money(d.totals?.outstandingBalance) },
        { id: "rejectedRequests", label: "Rejected Requests", value: (d) => (d.totals?.requestsRejected ?? 0) },
        { id: "rejectedPayments", label: "Rejected Payments", value: (d) => (d.totals?.rejectedPayments ?? 0) },
      ],
    },
    {
      id: "byStatus",
      label: "Loans by Status",
      kind: "stat",
      stats: [{ id: "status", label: "Loans by Status", byStatus: (d) => byStatus(d.totals ?? {}, "byStatus") }],
    },
    {
      id: "loansTable",
      label: "Loan Records",
      kind: "table",
      table: {
        rows: (d) =>
          (((d.loans as unknown[]) ?? []) as Record<string, any>[]).filter(
            (loan) => loan.status !== "REJECTED",
          ),
        columns: [
          { id: "borrower", label: "Borrower", get: (r) => borrower(r).name ?? "", render: (r) => borrower(r).name ?? "—" },
          { id: "loan", label: "Loan", get: (r) => r.name ?? "", render: (r) => r.name ?? "—" },
          { id: "amount", label: "Amount", get: (r) => moneyValue(r.amount), render: (r) => money(r.amount), money: true },
          { id: "paid", label: "Paid", get: (r) => moneyValue(r.amountPaid), render: (r) => money(r.amountPaid), money: true },
          { id: "outstanding", label: "Outstanding", get: (r) => moneyValue(r.outstandingBalance), render: (r) => money(r.outstandingBalance), money: true },
          { id: "status", label: "Status", get: (r) => r.status ?? "", render: (r) => humanize(r.status) },
          { id: "due", label: "Due", get: (r) => dateValue(r.due), render: (r) => renderDate(r.due) },
        ],
        groupFields: [
          { key: "status", label: "Loan status", get: (r) => r.status ?? null },
          { key: "member", label: "Borrower", get: (r) => borrower(r).name ?? null },
          { key: "decision", label: "Decision", get: (r) => r.decision ?? null },
        ],
        totalColumns: ["amount", "paid", "outstanding"],
      },
    },
    {
      id: "rejectedTable",
      label: "Rejected Payment Submissions",
      kind: "table",
      hideWhenEmpty: (d) => {
        const loans = ((d.loans as unknown[]) ?? []) as Record<string, any>[];
        return !loans.some((l) => ((l.rejectedPayments as unknown[]) ?? []).length > 0);
      },
      table: {
        rows: (d) => {
          const loans = ((d.loans as unknown[]) ?? []) as Record<string, any>[];
          const out: Record<string, any>[] = [];
          for (const l of loans) {
            const b = borrower(l);
            for (const p of ((l.rejectedPayments as unknown[]) ?? []) as Record<string, any>[]) {
              out.push({
                borrower: b.name,
                loan: l.name,
                amount: moneyValue(p.amount),
                dateISO: p.createdAt,
                reason: p.rejectionReason,
              });
            }
          }
          return out;
        },
        columns: [
          { id: "borrower", label: "Borrower", get: (r) => r.borrower ?? "", render: (r) => r.borrower ?? "—" },
          { id: "loan", label: "Loan", get: (r) => r.loan ?? "", render: (r) => r.loan ?? "—" },
          { id: "amount", label: "Amount", get: (r) => r.amount, render: (r) => money(r.amount), money: true },
          { id: "date", label: "Date", get: (r) => dateValue(r.dateISO), render: (r) => renderDate(r.dateISO) },
          { id: "reason", label: "Reason", get: (r) => r.reason ?? "", render: (r) => r.reason || "—" },
        ],
        groupFields: [],
        totalColumns: ["amount"],
      },
    },
  ],
  defaultSections: ["totals", "byStatus", "loansTable"],
  presets: {
    summary: { id: "summary", label: "Summary", sections: ["totals", "byStatus"] },
    detailed: { id: "detailed", label: "Detailed", sections: ["totals", "byStatus", "loansTable"] },
    full: {
      id: "full",
      label: "Full Details",
      sections: ["totals", "byStatus", "loansTable", "rejectedTable"],
    },
  },
};

// ---------------------------------------------------------------- PAYMENTS

const PAYMENTS: ReportTypeCatalog = {
  type: "PAYMENTS",
  label: "Payment Activity Report",
  memberFilter: true,
  statusOptions: ["PENDING", "VERIFIED", "REJECTED"],
  notes: [
    "Rejected payment submissions are reported separately and excluded from verified amounts.",
    "Only records created within the selected period are included.",
  ],
  sections: [
    {
      id: "totals",
      label: "Payment Activity",
      kind: "kv",
      kvs: [
        { id: "payments", label: "Payments", value: (d) => (d.totals?.payments ?? 0) },
        { id: "pending", label: "Pending Amount", value: (d) => money(d.totals?.pendingAmount ?? paymentAmountFallback(d.payments, ["PENDING", "PENDING_APPROVAL"])) },
        { id: "verified", label: "Verified Amount", value: (d) => money(d.totals?.verifiedAmount ?? paymentAmountFallback(d.payments, ["VERIFIED", "APPROVED"])) },
        { id: "rejected", label: "Rejected Amount", value: (d) => money(d.totals?.rejectedAmount ?? paymentAmountFallback(d.payments, ["REJECTED", "DECLINED"])) },
      ],
    },
    {
      id: "byStatus",
      label: "Payments by Status",
      kind: "stat",
      stats: [{ id: "status", label: "By Status", byStatus: (d) => byStatus(d.totals ?? {}, "byStatus") }],
    },
    {
      id: "byMethod",
      label: "Payments by Method",
      kind: "stat",
      stats: [{ id: "method", label: "By Method", byStatus: (d) => byStatus(d.totals ?? {}, "byMethod") }],
    },
    {
      id: "paymentsTable",
      label: "Payment Records",
      kind: "table",
      table: {
        rows: (d) =>
          (((d.payments as unknown[]) ?? []) as Record<string, any>[]).filter(
            (payment) => payment.status !== "REJECTED" && payment.status !== "DECLINED",
          ),
        columns: [
          { id: "name", label: "Member", get: (r) => nameOf(r) ?? "", render: (r) => nameOf(r) },
          { id: "type", label: "Type", get: (r) => r.type ?? "", render: (r) => humanize(r.type) },
          { id: "method", label: "Method", get: (r) => r.paymentMethod ?? "", render: (r) => humanize(r.paymentMethod) },
          { id: "amount", label: "Amount", get: (r) => moneyValue(r.amount), render: (r) => money(r.amount), money: true },
          { id: "status", label: "Status", get: (r) => r.status ?? "", render: (r) => humanize(r.status) },
          { id: "reference", label: "Reference", get: (r) => r.referenceNo ?? "", render: (r) => r.referenceNo || "—" },
          { id: "date", label: "Date", get: (r) => dateValue(r.createdAt), render: (r) => renderDate(r.createdAt) },
        ],
        groupFields: [
          { key: "status", label: "Payment status", get: (r) => r.status ?? null },
          { key: "method", label: "Method", get: (r) => r.paymentMethod ?? null },
          { key: "type", label: "Type", get: (r) => r.type ?? null },
        ],
        totalColumns: ["amount"],
      },
    },
  ],
  defaultSections: ["totals", "byStatus", "byMethod", "paymentsTable"],
  presets: {
    summary: { id: "summary", label: "Summary", sections: ["totals", "byStatus", "byMethod"] },
    detailed: {
      id: "detailed",
      label: "Detailed",
      sections: ["totals", "byStatus", "byMethod", "paymentsTable"],
    },
    full: {
      id: "full",
      label: "Full Details",
      sections: ["totals", "byStatus", "byMethod", "paymentsTable"],
    },
  },
};

// ---------------------------------------------------------------- SUPPLIES

const SUPPLIES: ReportTypeCatalog = {
  type: "SUPPLIES",
  label: "Supply Inventory Report",
  memberFilter: true,
  statusOptions: ["PENDING", "APPROVED", "REJECTED", "COMPLETED"],
  notes: [
    "Sold and borrowed figures reflect completed transactions within the selected period.",
    "Paid borrowed repayments are supply-loan repayments recorded in the same period.",
  ],
  sections: [
    {
      id: "totals",
      label: "Supply Inventory",
      kind: "kv",
      kvs: [
        { id: "products", label: "Products", value: (d) => (d.totals?.products ?? 0) },
        { id: "units", label: "Units in Stock", value: (d) => (d.totals?.unitsInStock ?? 0) },
        { id: "value", label: "Inventory Value", value: (d) => money(d.totals?.inventoryValue) },
        { id: "requests", label: "Requests", value: (d) => (d.totals?.requests ?? 0) },
      ],
    },
    {
      id: "units",
      label: "Transaction Summary",
      kind: "units",
      units: [
        {
          id: "sold",
          label: "Sold",
          primary: (d) => `${d.totals?.sold?.units ?? 0} units`,
          secondary: (d) => money(d.totals?.sold?.amount),
        },
        {
          id: "borrowed",
          label: "Borrowed",
          primary: (d) => `${d.totals?.borrowed?.units ?? 0} units`,
          secondary: (d) => money(d.totals?.borrowed?.amount),
        },
        {
          id: "paid",
          label: "Paid Borrowed",
          primary: (d) => `${d.totals?.paidBorrowed?.repayments ?? 0} repayments`,
          secondary: (d) => money(d.totals?.paidBorrowed?.amount),
        },
      ],
    },
    {
      id: "byStatus",
      label: "Requests by Status",
      kind: "stat",
      stats: [{ id: "status", label: "Requests by Status", byStatus: (d) => byStatus(d.totals ?? {}, "requestsByStatus") }],
    },
    {
      id: "suppliesTable",
      label: "Supply Records",
      kind: "table",
      table: {
        rows: (d) => ((d.supplies as unknown[]) ?? []) as Record<string, any>[],
        columns: [
          { id: "product", label: "Product", get: (r) => r.productName ?? "", render: (r) => r.productName ?? "—" },
          { id: "price", label: "Price", get: (r) => moneyValue(r.price), render: (r) => money(r.price), money: true },
          { id: "qty", label: "Qty", get: (r) => moneyValue(r.quantity), render: (r) => String(r.quantity ?? 0) },
          { id: "sold", label: "Sold", get: (r) => moneyValue(r.soldUnits), render: (r) => String(r.soldUnits ?? 0) },
          { id: "borrowed", label: "Borrowed", get: (r) => moneyValue(r.borrowedUnits), render: (r) => String(r.borrowedUnits ?? 0) },
          { id: "value", label: "Inventory Value", get: (r) => moneyValue(r.inventoryValue), render: (r) => money(r.inventoryValue), money: true },
        ],
        groupFields: [],
        totalColumns: ["qty", "sold", "borrowed", "value"],
      },
    },
    {
      id: "transactionsTable",
      label: "Supply Transactions",
      kind: "table",
      hideWhenEmpty: (d) => {
        const supplies = ((d.supplies as unknown[]) ?? []) as Record<string, any>[];
        const txs = supplies.flatMap((s) => ((s.transactions as unknown[]) ?? []) as Record<string, any>[]);
        return txs.length === 0;
      },
      table: {
        rows: (d) => {
          const supplies = ((d.supplies as unknown[]) ?? []) as Record<string, any>[];
          const out: Record<string, any>[] = [];
          for (const s of supplies) {
            for (const t of ((s.transactions as unknown[]) ?? []) as Record<string, any>[]) {
              out.push({
                supply: s.productName,
                member: (t.user as Record<string, any>)?.name ?? "—",
                type: t.type,
                qty: moneyValue(t.quantity),
                total: moneyValue(t.totalPrice),
                status: t.status,
                createdISO: t.createdAt,
              });
            }
          }
          return out;
        },
        columns: [
          { id: "supply", label: "Supply", get: (r) => r.supply ?? "", render: (r) => r.supply ?? "—" },
          { id: "member", label: "Member", get: (r) => r.member ?? "", render: (r) => r.member ?? "—" },
          { id: "type", label: "Type", get: (r) => r.type ?? "", render: (r) => humanize(r.type) },
          { id: "qty", label: "Qty", get: (r) => r.qty, render: (r) => String(r.qty || 0) },
          { id: "total", label: "Total", get: (r) => r.total, render: (r) => money(r.total), money: true },
          { id: "status", label: "Status", get: (r) => r.status ?? "", render: (r) => humanize(r.status) },
          { id: "date", label: "Date", get: (r) => dateValue(r.createdISO), render: (r) => renderDate(r.createdISO) },
        ],
        groupFields: [
          { key: "status", label: "Status", get: (r) => r.status ?? null },
          { key: "type", label: "Type", get: (r) => r.type ?? null },
        ],
        totalColumns: ["qty", "total"],
      },
    },
  ],
  defaultSections: ["totals", "units", "byStatus", "suppliesTable"],
  presets: {
    summary: { id: "summary", label: "Summary", sections: ["totals", "units", "byStatus"] },
    detailed: {
      id: "detailed",
      label: "Detailed",
      sections: ["totals", "units", "byStatus", "suppliesTable"],
    },
    full: {
      id: "full",
      label: "Full Details",
      sections: ["totals", "units", "byStatus", "suppliesTable", "transactionsTable"],
    },
  },
};

// ---------------------------------------------------------------- MACHINES

const MACHINES: ReportTypeCatalog = {
  type: "MACHINES",
  label: "Machinery Utilization Report",
  memberFilter: true,
  statusOptions: ["QUEUED", "APPROVED", "IN_USE", "RETURN_PENDING", "RETURNED", "OVERDUE", "REJECTED"],
  notes: [
    "Requests are a snapshot of machine borrowing activity in the selected period.",
  ],
  sections: [
    {
      id: "totals",
      label: "Machinery",
      kind: "kv",
      kvs: [
        { id: "machines", label: "Machines", value: (d) => (d.totals?.machines ?? 0) },
        { id: "requests", label: "Requests", value: (d) => (d.totals?.requests ?? 0) },
      ],
    },
    {
      id: "byStatus",
      label: "Requests by Status",
      kind: "stat",
      stats: [{ id: "status", label: "Requests by Status", byStatus: (d) => byStatus(d.totals ?? {}, "requestsByStatus") }],
    },
    {
      id: "requestsTable",
      label: "Machine Requests",
      kind: "table",
      table: {
        rows: (d) => {
          const machines = ((d.machines as unknown[]) ?? []) as Record<string, any>[];
          const out: Record<string, any>[] = [];
          for (const m of machines) {
            for (const r of ((m.requests as unknown[]) ?? []) as Record<string, any>[]) {
              out.push({
                machine: m.name,
                member: (r.user as Record<string, any>)?.name ?? "—",
                status: r.status,
                requestedISO: r.requestDate,
                startISO: r.startDate,
                endISO: r.endDate,
                returnedISO: r.returnedAt,
              });
            }
          }
          return out;
        },
        columns: [
          { id: "machine", label: "Machine", get: (r) => r.machine ?? "", render: (r) => r.machine ?? "—" },
          { id: "member", label: "Member", get: (r) => r.member ?? "", render: (r) => r.member ?? "—" },
          { id: "status", label: "Status", get: (r) => r.status ?? "", render: (r) => humanize(r.status) },
          { id: "requested", label: "Requested", get: (r) => dateValue(r.requestedISO), render: (r) => renderDate(r.requestedISO) },
          { id: "start", label: "Start", get: (r) => dateValue(r.startISO), render: (r) => renderDate(r.startISO) },
          { id: "end", label: "End", get: (r) => dateValue(r.endISO), render: (r) => renderDate(r.endISO) },
          { id: "returned", label: "Returned", get: (r) => dateValue(r.returnedISO), render: (r) => renderDate(r.returnedISO) },
        ],
        groupFields: [
          { key: "status", label: "Status", get: (r) => r.status ?? null },
          { key: "machine", label: "Machine", get: (r) => r.machine ?? null },
        ],
      },
    },
    {
      id: "machineList",
      label: "Machines",
      kind: "machineList",
      machines: (d) => {
        const machines = ((d.machines as unknown[]) ?? []) as Record<string, any>[];
        return machines.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description ?? null,
          requests: ((m.requests as unknown[]) ?? []) as Record<string, any>[],
        }));
      },
    },
  ],
  defaultSections: ["totals", "byStatus", "requestsTable"],
  presets: {
    summary: { id: "summary", label: "Summary", sections: ["totals", "byStatus"] },
    detailed: { id: "detailed", label: "Detailed", sections: ["totals", "byStatus", "requestsTable"] },
    full: {
      id: "full",
      label: "Full Details",
      sections: ["totals", "byStatus", "requestsTable", "machineList"],
    },
  },
};

// ---------------------------------------------------------------- AUDIT

const AUDIT: ReportTypeCatalog = {
  type: "AUDIT",
  label: "Audit Activity Report",
  memberFilter: false,
  notes: ["Limited to the most recent 1,000 audit entries."],
  sections: [
    {
      id: "totals",
      label: "Audit Activity",
      kind: "kv",
      kvs: [
        { id: "entries", label: "Entries", value: (d) => (d.totals?.entries ?? 0) },
        { id: "limit", label: "Limit", value: (d) => (d.totals?.limitedToMostRecent ?? "—") },
      ],
    },
    {
      id: "byAction",
      label: "Entries by Action",
      kind: "stat",
      stats: [{ id: "action", label: "By Action", byStatus: (d) => byStatus(d.totals ?? {}, "byAction") }],
    },
    {
      id: "auditTable",
      label: "Audit Entries",
      kind: "table",
      table: {
        rows: (d) => ((d.entries as unknown[]) ?? []) as Record<string, any>[],
        columns: [
          { id: "userName", label: "User", get: (r) => (r.user as Record<string, any>)?.name ?? "", render: (r) => (r.user as Record<string, any>)?.name ?? "—" },
          { id: "role", label: "Role", get: (r) => (r.user as Record<string, any>)?.role ?? "", render: (r) => humanize((r.user as Record<string, any>)?.role) },
          { id: "action", label: "Action", get: (r) => r.action ?? "", render: (r) => humanize(r.action) },
          { id: "entity", label: "Entity", get: (r) => r.entity ?? "", render: (r) => r.entity ?? "—" },
          { id: "when", label: "When", get: (r) => dateValue(r.createdAt), render: (r) => renderDateTime(r.createdAt) },
        ],
        groupFields: [
          { key: "action", label: "Action", get: (r) => r.action ?? null },
        ],
      },
    },
  ],
  defaultSections: ["totals", "byAction", "auditTable"],
  presets: {
    summary: { id: "summary", label: "Summary", sections: ["totals", "byAction"] },
    detailed: { id: "detailed", label: "Detailed", sections: ["totals", "byAction", "auditTable"] },
    full: { id: "full", label: "Full Details", sections: ["totals", "byAction", "auditTable"] },
  },
};

// ---------------------------------------------------------------- SUMMARY

const SUMMARY: ReportTypeCatalog = {
  type: "SUMMARY",
  label: "Cooperative Summary Report",
  memberFilter: false,
  statusOptions: ["PENDING", "VERIFIED", "REJECTED", "ACTIVE", "OVERDUE", "PAID"],
  notes: [
    "Rejected loan requests are excluded from financial totals.",
    "Date filters limit visible records to activity in the selected period.",
    "Rejected payment submissions are reported separately.",
  ],
  sections: [
    {
      id: "members",
      label: "Members",
      kind: "kv",
      kvs: [{ id: "members", label: "Members", value: (d) => (d.members?.users ?? 0) }],
    },
    {
      id: "loans",
      label: "Loans",
      kind: "kv",
      kvs: [
        { id: "loans", label: "Loans", value: (d) => (d.loans?.count ?? 0) },
        { id: "principal", label: "Loan Principal", value: (d) => money(d.loans?.principal) },
        { id: "paid", label: "Loan Paid", value: (d) => money(d.loans?.amountPaid) },
        { id: "outstanding", label: "Outstanding", value: (d) => money(d.loans?.outstandingBalance) },
        { id: "rejected", label: "Rejected Requests", value: (d) => (d.loans?.rejectedRequests ?? 0) },
      ],
    },
    {
      id: "payments",
      label: "Payments",
      kind: "kv",
      kvs: [
        { id: "payments", label: "Payments", value: (d) => (d.payments?.count ?? 0) },
        { id: "pending", label: "Pending Amount", value: (d) => money(d.payments?.pendingAmount ?? paymentAmountFallback(d.payments?.list, ["PENDING", "PENDING_APPROVAL"])) },
        { id: "verified", label: "Verified Amount", value: (d) => money(d.payments?.verifiedAmount ?? paymentAmountFallback(d.payments?.list, ["VERIFIED", "APPROVED"])) },
        { id: "rejected", label: "Rejected Amount", value: (d) => money(d.payments?.rejectedAmount ?? paymentAmountFallback(d.payments?.list, ["REJECTED", "DECLINED"])) },
      ],
    },
    {
      id: "supplies",
      label: "Supply Inventory",
      kind: "kv",
      kvs: [
        { id: "products", label: "Products", value: (d) => (d.supplies?.products ?? 0) },
        { id: "units", label: "Units in Stock", value: (d) => (d.supplies?.unitsInStock ?? 0) },
        { id: "value", label: "Inventory Value", value: (d) => money(d.supplies?.inventoryValue) },
      ],
    },
    {
      id: "machines",
      label: "Machines",
      kind: "kv",
      kvs: [
        { id: "machines", label: "Machines", value: (d) => (d.machines?.count ?? 0) },
        { id: "requests", label: "Machine Requests", value: (d) => (d.machines?.requests ?? 0) },
      ],
    },
    {
      id: "audit",
      label: "Audit",
      kind: "kv",
      kvs: [{ id: "audit", label: "Audit Entries", value: (d) => (d.audit?.entries ?? 0) }],
    },
    {
      id: "stats",
      label: "Status Overview",
      kind: "stat",
      stats: [
        { id: "loans", label: "Loans by Status", byStatus: (d) => byStatus(d.loans ?? {}, "byStatus") },
        { id: "payments", label: "Payments by Status", byStatus: (d) => byStatus(d.payments ?? {}, "byStatus") },
        { id: "methods", label: "Payments by Method", byStatus: (d) => byStatus(d.payments ?? {}, "byMethod") },
        { id: "machines", label: "Machines by Status", byStatus: (d) => byStatus(d.machines ?? {}, "requestsByStatus") },
        { id: "supplies", label: "Supply Requests by Status", byStatus: (d) => byStatus(d.supplies ?? {}, "requestsByStatus") },
      ],
    },
    {
      id: "units",
      label: "Supply Movement",
      kind: "units",
      units: [
        { id: "sold", label: "Sold", primary: (d) => `${d.supplies?.sold?.units ?? 0} units`, secondary: (d) => money(d.supplies?.sold?.amount) },
        { id: "borrowed", label: "Borrowed", primary: (d) => `${d.supplies?.borrowed?.units ?? 0} units`, secondary: (d) => money(d.supplies?.borrowed?.amount) },
        { id: "paid", label: "Paid Borrowed", primary: (d) => `${d.supplies?.paidBorrowed?.repayments ?? 0} repayments`, secondary: (d) => money(d.supplies?.paidBorrowed?.amount) },
      ],
    },
    {
      id: "transactions",
      label: "Recent Transactions",
      kind: "table",
      hideWhenEmpty: (d) => ((d.transactions as unknown[]) ?? []).length === 0,
      table: {
        rows: (d) => ((d.transactions as unknown[]) ?? []) as Record<string, any>[],
        columns: [
          { id: "name", label: "Member", get: (r) => nameOf(r) ?? "", render: (r) => nameOf(r) },
          { id: "type", label: "Type", get: (r) => r.type ?? "", render: (r) => humanize(r.type) },
          { id: "method", label: "Method", get: (r) => r.paymentMethod ?? "", render: (r) => humanize(r.paymentMethod) },
          { id: "amount", label: "Amount", get: (r) => moneyValue(r.amount), render: (r) => money(r.amount), money: true },
          { id: "status", label: "Status", get: (r) => r.status ?? "", render: (r) => humanize(r.status) },
          { id: "reference", label: "Reference", get: (r) => r.referenceNo ?? "", render: (r) => r.referenceNo || "—" },
          { id: "date", label: "Date", get: (r) => dateValue(r.createdAt), render: (r) => renderDate(r.createdAt) },
        ],
        groupFields: [
          { key: "status", label: "Status", get: (r) => r.status ?? null },
          { key: "method", label: "Method", get: (r) => r.paymentMethod ?? null },
          { key: "type", label: "Type", get: (r) => r.type ?? null },
        ],
        totalColumns: ["amount"],
      },
    },
    {
      id: "loansTable",
      label: "Loan Records",
      kind: "table",
      hideWhenEmpty: (d) =>
        (((d.loans?.list as unknown[]) ?? []) as Record<string, any>[]).every(
          (loan) => loan.status === "REJECTED",
        ),
      table: {
        rows: (d) =>
          (((d.loans?.list as unknown[]) ?? []) as Record<string, any>[]).filter(
            (loan) => loan.status !== "REJECTED",
          ),
        columns: [
          { id: "name", label: "Member", get: (r) => (r.user as Record<string, any>)?.name ?? "", render: (r) => (r.user as Record<string, any>)?.name ?? "—" },
          { id: "amount", label: "Amount", get: (r) => moneyValue(r.amount), render: (r) => money(r.amount), money: true },
          { id: "paid", label: "Paid", get: (r) => moneyValue(r.amountPaid), render: (r) => money(r.amountPaid), money: true },
          { id: "outstanding", label: "Outstanding", get: (r) => moneyValue(r.outstandingBalance), render: (r) => money(r.outstandingBalance), money: true },
          { id: "status", label: "Status", get: (r) => r.status ?? "", render: (r) => humanize(r.status) },
          { id: "due", label: "Due", get: (r) => dateValue(r.due), render: (r) => renderDate(r.due) },
        ],
        groupFields: [
          { key: "status", label: "Loan status", get: (r) => r.status ?? null },
          { key: "member", label: "Member", get: (r) => (r.user as Record<string, any>)?.name ?? null },
        ],
        totalColumns: ["amount", "paid", "outstanding"],
      },
    },
    {
      id: "paymentsTable",
      label: "Payment Records",
      kind: "table",
      hideWhenEmpty: (d) =>
        (((d.payments?.list as unknown[]) ?? []) as Record<string, any>[]).every(
          (payment) => payment.status === "REJECTED" || payment.status === "DECLINED",
        ),
      table: {
        rows: (d) =>
          (((d.payments?.list as unknown[]) ?? []) as Record<string, any>[]).filter(
            (payment) => payment.status !== "REJECTED" && payment.status !== "DECLINED",
          ),
        columns: [
          { id: "name", label: "Member", get: (r) => nameOf(r) ?? "", render: (r) => nameOf(r) },
          { id: "type", label: "Type", get: (r) => r.type ?? "", render: (r) => humanize(r.type) },
          { id: "method", label: "Method", get: (r) => r.paymentMethod ?? "", render: (r) => humanize(r.paymentMethod) },
          { id: "amount", label: "Amount", get: (r) => moneyValue(r.amount), render: (r) => money(r.amount), money: true },
          { id: "status", label: "Status", get: (r) => r.status ?? "", render: (r) => humanize(r.status) },
          { id: "reference", label: "Reference", get: (r) => r.referenceNo ?? "", render: (r) => r.referenceNo || "—" },
          { id: "date", label: "Date", get: (r) => dateValue(r.createdAt), render: (r) => renderDate(r.createdAt) },
        ],
        groupFields: [
          { key: "status", label: "Payment status", get: (r) => r.status ?? null },
          { key: "method", label: "Method", get: (r) => r.paymentMethod ?? null },
          { key: "type", label: "Type", get: (r) => r.type ?? null },
        ],
        totalColumns: ["amount"],
      },
    },
  ],
  defaultSections: [
    "members",
    "loans",
    "payments",
    "supplies",
    "machines",
    "audit",
    "stats",
    "units",
    "transactions",
  ],
  presets: {
    summary: {
      id: "summary",
      label: "Summary",
      sections: ["members", "loans", "payments", "supplies", "machines", "audit", "stats", "units"],
    },
    detailed: {
      id: "detailed",
      label: "Detailed",
      sections: ["members", "loans", "payments", "supplies", "machines", "audit", "stats", "units", "transactions"],
    },
    full: {
      id: "full",
      label: "Full Details",
      sections: ["members", "loans", "payments", "supplies", "machines", "audit", "stats", "units", "transactions", "loansTable", "paymentsTable"],
    },
  },
};

const CATALOGS: Record<string, ReportTypeCatalog> = {
  SUMMARY,
  MEMBERS,
  LOANS,
  PAYMENTS,
  SUPPLIES,
  MACHINES,
  AUDIT,
};

export function getCatalog(type: string): ReportTypeCatalog | null {
  return CATALOGS[type] ?? null;
}

export function allColumnIds(section: ReportTypeCatalog["sections"][number]): string[] {
  return section.table ? section.table.columns.map((c) => c.id) : [];
}

export function aggregateGroupOptions(catalog: ReportTypeCatalog): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const section of catalog.sections) {
    for (const gf of section.table?.groupFields ?? []) {
      if (!seen.has(gf.key)) {
        seen.add(gf.key);
        out.push({ key: gf.key, label: gf.label });
      }
    }
  }
  return out;
}

export function aggregateSortFields(catalog: ReportTypeCatalog): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const section of catalog.sections) {
    for (const col of section.table?.columns ?? []) {
      if (!seen.has(col.id)) {
        seen.add(col.id);
        out.push({ id: col.id, label: col.label });
      }
    }
  }
  return out;
}

export { renderDate, renderDateTime, humanize, moneyValue } from "./format";
