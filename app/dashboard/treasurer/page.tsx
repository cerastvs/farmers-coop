"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ImageModal } from "@/components/ImageModal";
import { IconLeaf } from "@/components/icons";
import {
  Bell,
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Banknote,
  Users,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  LogOut,
} from "lucide-react";
import { logout } from "../../login/actions";

type Tab = "overview" | "loans" | "payments" | "overdue";
type LoanType = "SUPPLY" | "MONEY";
type LoanSubTab = "requests" | "active" | "overdue";
type PaymentFilter = "ALL" | "PENDING" | "VERIFIED" | "REJECTED";

interface Loan {
  id: string;
  borrower: { name: string; username: string };
  name: string;
  type: string;
  amount: number;
  remainingBalance: number;
  termMonths: number;
  purpose: string | null;
  status: string;
  rejectionReason: string | null;
  due: string | null;
  createdAt: string;
}

interface Payment {
  id: string;
  user: { name: string; username: string };
  loan: { name: string; type: string } | null;
  amount: number;
  receiptUrl: string | null;
  referenceNo: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
}

interface TreasurerData {
  loans: Loan[];
  payments: Payment[];
}

const buttonPrimary =
  "inline-flex items-center gap-1.5 rounded-lg bg-[#1b5e3b] px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-[#15503a] hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
const buttonSecondary =
  "inline-flex items-center gap-1.5 rounded-lg border border-[#dce5d9] bg-white px-3.5 py-2 text-xs font-semibold text-[#1b5e3b] transition-all hover:bg-[#f0f7eb] hover:border-[#c8d9c3] active:scale-[0.98] disabled:opacity-40";
const buttonDanger =
  "inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 transition-all hover:bg-red-50 hover:border-red-300 active:scale-[0.98] disabled:opacity-40";

function getSecureProofUrl(receiptUrl: string | null) {
  if (!receiptUrl) return null;
  try {
    const url = new URL(receiptUrl);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function requestJson(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error ?? data.message ?? "Request failed");
  return data;
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  REJECTED: "bg-red-50 text-red-700 ring-1 ring-red-200",
  ACTIVE: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  OVERDUE: "bg-red-50 text-red-700 ring-2 ring-red-300",
  PAID: "bg-gray-100 text-gray-600 ring-1 ring-gray-200",
  VERIFIED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${STATUS_STYLE[status] || "bg-gray-100 text-gray-500"}`}
    >
      {status}
    </span>
  );
}

function isOverdueLoan(l: Pick<Loan, "status" | "due">, now: Date) {
  return (
    l.status === "OVERDUE" ||
    (l.status === "ACTIVE" && !!l.due && new Date(l.due) < now)
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
  icon: Icon,
  delay,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  icon: React.ElementType;
  delay?: number;
}) {
  return (
    <div
      className="animate-slideUp relative overflow-hidden rounded-xl border border-[#e2ebe6] bg-white p-4 shadow-sm"
      style={{ animationDelay: `${delay ?? 0}ms` }}
    >
      <div
        className={`absolute left-0 top-0 h-full w-[3px] ${accent}`}
      />
      <div className="flex items-start justify-between">
        <div className="pl-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#5a7267]">
            {label}
          </p>
          <p
            className="mt-1 font-mono text-2xl font-bold tracking-tight text-[#0f2318]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {value}
          </p>
          {sub && (
            <p className="mt-0.5 text-[11px] text-[#5a7267]">{sub}</p>
          )}
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#f0f7eb]">
          <Icon size={16} className="text-[#1b5e3b]" />
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#f8faf9]">
      <div className="h-14 bg-[#1b5e3b]" />
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="mb-6 h-8 w-48 animate-pulse rounded-lg bg-[#e2ebe6]" />
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-[#e2ebe6] bg-white"
            />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="h-96 animate-pulse rounded-xl border border-[#e2ebe6] bg-white" />
          <div className="h-96 animate-pulse rounded-xl border border-[#e2ebe6] bg-white" />
        </div>
      </div>
    </div>
  );
}

export default function TreasurerPage() {
  const [data, setData] = useState<TreasurerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [proofModalUrl, setProofModalUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Loans sub-state
  const [loanType, setLoanType] = useState<LoanType>("MONEY");
  const [loanSubTab, setLoanSubTab] = useState<LoanSubTab>("requests");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("ALL");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/treasurer/stats");
      if (res.ok) setData(await res.json());
    } catch {
      console.error("Failed to fetch treasurer data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function mutate(
    key: string,
    url: string,
    body: unknown,
    success: string,
    method = "PATCH",
  ) {
    setBusy(key);
    setNotice(null);
    try {
      await requestJson(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setNotice({ kind: "success", text: success });
      await fetchData();
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Action failed",
      });
    } finally {
      setBusy(null);
    }
  }

  function rejectReason() {
    return window.prompt("Enter the reason for rejection:");
  }

  const now = useMemo(() => new Date(), []);

  // ── Computed stats ──
  const stats = useMemo(() => {
    if (!data) return null;
    const pendingLoans = data.loans.filter((l) => l.status === "PENDING");
    const activeLoans = data.loans.filter(
      (l) => l.status === "APPROVED" || l.status === "ACTIVE",
    );
    const outstanding = activeLoans.reduce(
      (sum, l) => sum + l.remainingBalance,
      0,
    );
    const overdueLoans = data.loans.filter((l) =>
      isOverdueLoan(l, now),
    );
    const pendingPayments = data.payments.filter(
      (p) => p.status === "PENDING",
    );
    const totalReceived = data.payments
      .filter((p) => p.status === "VERIFIED")
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      pendingLoans: pendingLoans.length,
      activeLoans: activeLoans.length,
      outstanding,
      overdue: overdueLoans.length,
      pendingPayments: pendingPayments.length,
      totalReceived,
      totalLoans: data.loans.length,
      totalPayments: data.payments.length,
    };
  }, [data, now]);

  // ── Loan filtering ──
  const filteredLoans = useMemo(() => {
    if (!data) return [];
    return data.loans.filter((l) => l.type === loanType);
  }, [data, loanType]);

  const loanRequests = useMemo(
    () => filteredLoans.filter((l) => l.status === "PENDING"),
    [filteredLoans],
  );
  const loanActive = useMemo(
    () =>
      filteredLoans.filter(
        (l) => l.status === "APPROVED" || l.status === "ACTIVE",
      ),
    [filteredLoans],
  );
  const loanOverdue = useMemo(
    () => filteredLoans.filter((l) => isOverdueLoan(l, now)),
    [filteredLoans, now],
  );

  const currentLoans =
    loanSubTab === "requests"
      ? loanRequests
      : loanSubTab === "active"
        ? loanActive
        : loanOverdue;

  // ── Payment filtering ──
  const pendingPayments = useMemo(
    () => data?.payments.filter((p) => p.status === "PENDING") ?? [],
    [data],
  );
  const filteredPayments = useMemo(() => {
    if (!data) return [];
    if (paymentFilter === "ALL") return data.payments;
    return data.payments.filter((p) => p.status === paymentFilter);
  }, [data, paymentFilter]);

  // ── Overdue (all types) ──
  const overdueLoans = useMemo(
    () => data?.loans.filter((l) => isOverdueLoan(l, now)) ?? [],
    [data, now],
  );

  // ── Search filter for tables ──
  const searchLower = searchQuery.toLowerCase();
  const searchedPayments = useMemo(
    () =>
      filteredPayments.filter(
        (p) =>
          !searchLower ||
          p.user.name.toLowerCase().includes(searchLower) ||
          p.user.username.toLowerCase().includes(searchLower) ||
          (p.loan?.name ?? "").toLowerCase().includes(searchLower),
      ),
    [filteredPayments, searchLower],
  );
  const searchedLoans = useMemo(
    () =>
      currentLoans.filter(
        (l) =>
          !searchLower ||
          l.borrower.name.toLowerCase().includes(searchLower) ||
          l.borrower.username.toLowerCase().includes(searchLower) ||
          l.name.toLowerCase().includes(searchLower),
      ),
    [currentLoans, searchLower],
  );

  // ── Recent activity for sidebar ──
  const recentActivity = useMemo(() => {
    if (!data) return [];
    const items: {
      id: string;
      text: string;
      time: string;
      kind: "loan" | "payment";
    }[] = [];
    data.loans.slice(0, 5).forEach((l) => {
      items.push({
        id: `loan-${l.id}`,
        text: `${l.borrower.name} — ${l.status.toLowerCase()} ${l.name} loan`,
        time: new Date(l.createdAt).toLocaleDateString(),
        kind: "loan",
      });
    });
    data.payments.slice(0, 5).forEach((p) => {
      items.push({
        id: `pay-${p.id}`,
        text: `${p.user.name} — ₱${p.amount.toLocaleString()} ${p.status.toLowerCase()}`,
        time: new Date(p.createdAt).toLocaleDateString(),
        kind: "payment",
      });
    });
    return items
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 8);
  }, [data]);

  if (loading) return <LoadingSkeleton />;

  const nowDate = new Date();
  const formattedDate = nowDate.toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = nowDate.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-[#f8faf9]">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#1b5e3b] text-white shadow-lg shadow-[#0f2318]/10">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#d6ed9f] text-[#1b5e3b]">
                <IconLeaf className="h-4 w-4" />
              </span>
              <span
                className="text-sm font-bold tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                FarmCoop
              </span>
            </Link>
            <div className="hidden h-5 w-px bg-white/20 sm:block" />
            <p className="hidden text-xs font-medium text-white/70 sm:block">
              Treasurer workspace
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 text-xs text-white/60 md:flex">
              <Calendar size={13} />
              <span>{formattedDate}</span>
              <span className="text-white/30">·</span>
              <Clock size={13} />
              <span style={{ fontFamily: "var(--font-mono)" }}>
                {formattedTime}
              </span>
            </div>

            <div className="relative hidden sm:block">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
              />
              <input
                type="text"
                placeholder="Search members, loans…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-48 rounded-lg border border-white/20 bg-white/10 pl-9 pr-3 text-xs text-white placeholder-white/40 outline-none transition-all focus:w-56 focus:border-white/40 focus:bg-white/15"
              />
            </div>

            <Link
              href="/dashboard/notifications"
              className="relative rounded-lg p-2 transition-colors hover:bg-white/15"
              aria-label="Notifications"
            >
              <Bell size={18} />
            </Link>

            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/15"
              >
                <div className="grid h-7 w-7 place-items-center rounded-full bg-[#2d8a56] text-[10px] font-bold text-white">
                  T
                </div>
                <ChevronDown size={14} className="text-white/60" />
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-[#e2ebe6] bg-white py-1 shadow-2xl">
                    <Link
                      href="/registration"
                      onClick={() => setMenuOpen(false)}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-medium text-[#0f2318] transition-colors hover:bg-[#f0f7eb]"
                    >
                      Edit profile
                    </Link>
                    <Link
                      href="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-medium text-[#0f2318] transition-colors hover:bg-[#f0f7eb]"
                    >
                      Member dashboard
                    </Link>
                    <div className="my-1 h-px bg-[#e2ebe6]" />
                    <form action={logout}>
                      <button
                        type="submit"
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                      >
                        <LogOut size={13} />
                        Sign out
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="mx-auto max-w-[1400px] px-6 py-6">
        {/* Page title */}
        <div className="mb-6 animate-fadeIn">
          <h1
            className="text-xl font-bold text-[#0f2318]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Treasurer dashboard
          </h1>
          <p className="mt-0.5 text-sm text-[#5a7267]">
            Financial overview and loan management
          </p>
        </div>

        {/* Notice */}
        {notice && (
          <div
            role="status"
            aria-live="polite"
            className={`mb-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${notice.kind === "success" ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-red-50 text-red-800 ring-1 ring-red-200"}`}
          >
            {notice.kind === "success" ? (
              <CheckCircle2 size={16} />
            ) : (
              <XCircle size={16} />
            )}
            {notice.text}
          </div>
        )}

        {/* ── Stat cards ── */}
        {stats && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard
              label="Pending loans"
              value={stats.pendingLoans}
              sub="Awaiting review"
              accent="bg-amber-500"
              icon={FileText}
              delay={0}
            />
            <StatCard
              label="Active loans"
              value={stats.activeLoans}
              sub={`${stats.totalLoans} total`}
              accent="bg-[#1b5e3b]"
              icon={TrendingUp}
              delay={50}
            />
            <StatCard
              label="Outstanding"
              value={`₱${stats.outstanding.toLocaleString()}`}
              sub="Remaining balance"
              accent="bg-blue-500"
              icon={Banknote}
              delay={100}
            />
            <StatCard
              label="Overdue"
              value={stats.overdue}
              sub={stats.overdue > 0 ? "Requires attention" : "All on track"}
              accent={stats.overdue > 0 ? "bg-red-500" : "bg-emerald-500"}
              icon={AlertTriangle}
              delay={150}
            />
            <StatCard
              label="Pending payments"
              value={stats.pendingPayments}
              sub="Awaiting verification"
              accent="bg-amber-500"
              icon={Clock}
              delay={200}
            />
            <StatCard
              label="Payments received"
              value={`₱${stats.totalReceived.toLocaleString()}`}
              sub={`${stats.totalPayments} total`}
              accent="bg-emerald-500"
              icon={Banknote}
              delay={250}
            />
          </div>
        )}

        {/* ── Navigation tabs ── */}
        <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-[#e2ebe6] bg-white p-1 shadow-sm">
          {(["overview", "loans", "payments", "overdue"] as const).map((item) => (
            <button
              key={item}
              onClick={() => {
                setTab(item);
                setNotice(null);
              }}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2.5 text-xs font-semibold capitalize transition-all ${
                tab === item
                  ? "bg-[#1b5e3b] text-white shadow-sm"
                  : "text-[#5a7267] hover:bg-[#f0f7eb] hover:text-[#1b5e3b]"
              }`}
            >
              {item === "overview" && <TrendingUp size={13} />}
              {item === "loans" && <FileText size={13} />}
              {item === "payments" && <Banknote size={13} />}
              {item === "overdue" && <AlertTriangle size={13} />}
              {item}
              {item === "overdue" && overdueLoans.length > 0 && (
                <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {overdueLoans.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Content grid ── */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* ── Left: Main content ── */}
          <div className="min-w-0">
            {/* ═══ OVERVIEW TAB ═══ */}
            {tab === "overview" && (
              <div className="space-y-6 animate-fadeIn">
                {/* Pending loan approvals */}
                <section className="rounded-xl border border-[#e2ebe6] bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-[#f0f3ed] px-5 py-4">
                    <div>
                      <h2
                        className="text-sm font-bold text-[#0f2318]"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        Loan approvals needed
                      </h2>
                      <p className="text-xs text-[#5a7267]">
                        {loanRequests.length} pending request{loanRequests.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => setTab("loans")}
                      className="text-xs font-semibold text-[#1b5e3b] transition-colors hover:text-[#15503a]"
                    >
                      View all →
                    </button>
                  </div>
                  {loanRequests.length > 0 ? (
                    <div className="divide-y divide-[#f0f3ed]">
                      {loanRequests.slice(0, 4).map((loan) => (
                        <div
                          key={loan.id}
                          className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-[#fafcfb]"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[#0f2318]">
                              {loan.borrower.name}
                            </p>
                            <p className="text-xs text-[#5a7267]">
                              {loan.name} · ₱{loan.amount.toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={loan.status} />
                            <button
                              disabled={busy === loan.id}
                              onClick={() =>
                                mutate(
                                  loan.id,
                                  `/api/admin/loans/${loan.id}`,
                                  { action: "approve" },
                                  "Loan approved.",
                                )
                              }
                              className={buttonPrimary}
                            >
                              Approve
                            </button>
                            <button
                              disabled={busy === loan.id}
                              onClick={() => {
                                const reason = rejectReason();
                                if (reason)
                                  void mutate(
                                    loan.id,
                                    `/api/admin/loans/${loan.id}`,
                                    { action: "reject", reason },
                                    "Loan rejected.",
                                  );
                              }}
                              className={buttonDanger}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-5 py-8 text-center">
                      <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
                      <p className="text-sm text-[#5a7267]">
                        No pending loan requests. All caught up.
                      </p>
                    </div>
                  )}
                </section>

                {/* Pending payments */}
                <section className="rounded-xl border border-[#e2ebe6] bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-[#f0f3ed] px-5 py-4">
                    <div>
                      <h2
                        className="text-sm font-bold text-[#0f2318]"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        Payments to verify
                      </h2>
                      <p className="text-xs text-[#5a7267]">
                        {pendingPayments.length} pending
                      </p>
                    </div>
                    <button
                      onClick={() => setTab("payments")}
                      className="text-xs font-semibold text-[#1b5e3b] transition-colors hover:text-[#15503a]"
                    >
                      View all →
                    </button>
                  </div>
                  {pendingPayments.length > 0 ? (
                    <div className="divide-y divide-[#f0f3ed]">
                      {pendingPayments.slice(0, 4).map((payment) => {
                        const proofUrl = getSecureProofUrl(payment.receiptUrl);
                        return (
                          <div
                            key={payment.id}
                            className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-[#fafcfb]"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-[#0f2318]">
                                {payment.user.name}
                              </p>
                              <p className="text-xs text-[#5a7267]">
                                ₱{payment.amount.toLocaleString()} ·{" "}
                                {payment.loan?.name ?? "Payment"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {proofUrl && (
                                <button
                                  onClick={() => setProofModalUrl(proofUrl)}
                                  className="text-xs font-medium text-[#1b5e3b] underline-offset-2 hover:underline"
                                >
                                  View receipt
                                </button>
                              )}
                              <button
                                disabled={busy === payment.id}
                                onClick={() =>
                                  mutate(
                                    payment.id,
                                    `/api/admin/payments/${payment.id}`,
                                    { action: "verify" },
                                    "Payment verified.",
                                  )
                                }
                                className={buttonPrimary}
                              >
                                Verify
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-5 py-8 text-center">
                      <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
                      <p className="text-sm text-[#5a7267]">
                        No pending payments to review.
                      </p>
                    </div>
                  )}
                </section>

                {/* Overdue alerts */}
                {overdueLoans.length > 0 && (
                  <section className="rounded-xl border border-red-200 bg-red-50/50 shadow-sm">
                    <div className="flex items-center gap-2 border-b border-red-100 px-5 py-4">
                      <AlertTriangle size={16} className="text-red-600" />
                      <div>
                        <h2 className="text-sm font-bold text-red-800" style={{ fontFamily: "var(--font-display)" }}>
                          Overdue loans
                        </h2>
                        <p className="text-xs text-red-600">
                          {overdueLoans.length} loan{overdueLoans.length !== 1 ? "s" : ""} past due
                        </p>
                      </div>
                    </div>
                    <div className="divide-y divide-red-100">
                      {overdueLoans.slice(0, 3).map((loan) => {
                        const days = Math.floor(
                          (now.getTime() - new Date(loan.due!).getTime()) /
                            (1000 * 60 * 60 * 24),
                        );
                        return (
                          <div
                            key={loan.id}
                            className="flex items-center justify-between px-5 py-3"
                          >
                            <div>
                              <p className="text-sm font-semibold text-red-800">
                                {loan.borrower.name}
                              </p>
                              <p className="text-xs text-red-600">
                                {loan.name} · ₱{loan.amount.toLocaleString()}
                              </p>
                            </div>
                            <span
                              className="rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-bold text-red-700"
                              style={{ fontFamily: "var(--font-mono)" }}
                            >
                              {days}d overdue
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* ═══ LOANS TAB ═══ */}
            {tab === "loans" && (
              <section className="rounded-xl border border-[#e2ebe6] bg-white shadow-sm animate-fadeIn">
                <div className="border-b border-[#f0f3ed] px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2
                        className="text-sm font-bold text-[#0f2318]"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        Loan management
                      </h2>
                      <p className="text-xs text-[#5a7267]">
                        {filteredLoans.length} {loanType.toLowerCase()} loans
                      </p>
                    </div>
                    <div className="flex gap-1 rounded-lg border border-[#e2ebe6] bg-[#f8faf9] p-0.5">
                      {(["MONEY", "SUPPLY"] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setLoanType(type)}
                          className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all ${
                            loanType === type
                              ? "bg-white text-[#1b5e3b] shadow-sm"
                              : "text-[#5a7267] hover:text-[#0f2318]"
                          }`}
                        >
                          {type === "MONEY" ? "Money" : "Supply"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sub-tabs */}
                  <div className="mt-3 flex gap-1">
                    {([
                      { key: "requests" as const, label: "Requests", count: loanRequests.length, color: "amber" },
                      { key: "active" as const, label: "Active", count: loanActive.length, color: "blue" },
                      { key: "overdue" as const, label: "Overdue", count: loanOverdue.length, color: "red" },
                    ]).map((sub) => (
                      <button
                        key={sub.key}
                        onClick={() => setLoanSubTab(sub.key)}
                        className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all ${
                          loanSubTab === sub.key
                            ? sub.color === "amber"
                              ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                              : sub.color === "red"
                                ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                                : "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                            : "text-[#5a7267] hover:bg-[#f0f7eb]"
                        }`}
                      >
                        {sub.label}
                        <span
                          className="rounded-full bg-black/5 px-1.5 py-0.5 text-[9px]"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {sub.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Loan table */}
                {searchedLoans.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#f0f3ed] bg-[#fafcfb] text-[10px] uppercase tracking-wider text-[#5a7267]">
                          <th className="px-5 py-2.5 font-semibold">Member</th>
                          <th className="px-5 py-2.5 font-semibold">Type</th>
                          <th className="px-5 py-2.5 font-semibold text-right">Amount</th>
                          <th className="px-5 py-2.5 font-semibold text-right">Remaining</th>
                          <th className="px-5 py-2.5 font-semibold">Term</th>
                          <th className="px-5 py-2.5 font-semibold">Status</th>
                          <th className="px-5 py-2.5 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0f3ed]">
                        {searchedLoans.map((loan) => (
                          <tr
                            key={loan.id}
                            className="transition-colors hover:bg-[#fafcfb]"
                          >
                            <td className="px-5 py-3">
                              <p className="font-semibold text-[#0f2318]">
                                {loan.borrower.name}
                              </p>
                              <p className="text-[10px] text-[#5a7267]">
                                @{loan.borrower.username}
                              </p>
                            </td>
                            <td className="px-5 py-3">
                              <span className="rounded bg-[#f0f7eb] px-1.5 py-0.5 text-[10px] font-bold text-[#1b5e3b]">
                                {loan.name}
                              </span>
                            </td>
                            <td
                              className="px-5 py-3 text-right font-semibold text-[#0f2318]"
                              style={{ fontFamily: "var(--font-mono)" }}
                            >
                              ₱{loan.amount.toLocaleString()}
                            </td>
                            <td
                              className="px-5 py-3 text-right text-[#5a7267]"
                              style={{ fontFamily: "var(--font-mono)" }}
                            >
                              ₱{loan.remainingBalance.toLocaleString()}
                            </td>
                            <td className="px-5 py-3 text-[#5a7267]">
                              {loan.termMonths}mo
                            </td>
                            <td className="px-5 py-3">
                              <StatusBadge status={loan.status} />
                            </td>
                            <td className="px-5 py-3 text-right">
                              {loan.status === "PENDING" && (
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    disabled={busy === loan.id}
                                    onClick={() =>
                                      mutate(
                                        loan.id,
                                        `/api/admin/loans/${loan.id}`,
                                        { action: "approve" },
                                        "Loan approved.",
                                      )
                                    }
                                    className="rounded-md bg-[#1b5e3b] px-2.5 py-1 text-[10px] font-semibold text-white transition-all hover:bg-[#15503a] disabled:opacity-40"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    disabled={busy === loan.id}
                                    onClick={() => {
                                      const reason = rejectReason();
                                      if (reason)
                                        void mutate(
                                          loan.id,
                                          `/api/admin/loans/${loan.id}`,
                                          { action: "reject", reason },
                                          "Loan rejected.",
                                        );
                                    }}
                                    className="rounded-md border border-red-200 px-2.5 py-1 text-[10px] font-semibold text-red-600 transition-all hover:bg-red-50 disabled:opacity-40"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-5 py-12 text-center">
                    <FileText size={32} className="mx-auto mb-2 text-[#dce5d9]" />
                    <p className="text-sm text-[#5a7267]">
                      No {loanType.toLowerCase()} {loanSubTab} found.
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* ═══ PAYMENTS TAB ═══ */}
            {tab === "payments" && (
              <section className="rounded-xl border border-[#e2ebe6] bg-white shadow-sm animate-fadeIn">
                <div className="border-b border-[#f0f3ed] px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2
                        className="text-sm font-bold text-[#0f2318]"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        Payment history
                      </h2>
                      <p className="text-xs text-[#5a7267]">
                        {filteredPayments.length} payment{filteredPayments.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex gap-1 rounded-lg border border-[#e2ebe6] bg-[#f8faf9] p-0.5">
                      {(
                        [
                          { key: "ALL" as const, label: "All" },
                          { key: "PENDING" as const, label: "Pending" },
                          { key: "VERIFIED" as const, label: "Verified" },
                          { key: "REJECTED" as const, label: "Rejected" },
                        ] as const
                      ).map((f) => {
                        const count =
                          f.key === "ALL"
                            ? data?.payments.length ?? 0
                            : data?.payments.filter((p) => p.status === f.key).length ?? 0;
                        return (
                          <button
                            key={f.key}
                            onClick={() => setPaymentFilter(f.key)}
                            className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all ${
                              paymentFilter === f.key
                                ? "bg-white text-[#1b5e3b] shadow-sm"
                                : "text-[#5a7267] hover:text-[#0f2318]"
                            }`}
                          >
                            {f.label}
                            <span
                              className="ml-1 rounded-full bg-black/5 px-1.5 py-0.5 text-[9px]"
                              style={{ fontFamily: "var(--font-mono)" }}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {searchedPayments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#f0f3ed] bg-[#fafcfb] text-[10px] uppercase tracking-wider text-[#5a7267]">
                          <th className="px-5 py-2.5 font-semibold">Member</th>
                          <th className="px-5 py-2.5 font-semibold">Loan</th>
                          <th className="px-5 py-2.5 font-semibold text-right">Amount</th>
                          <th className="px-5 py-2.5 font-semibold">Date</th>
                          <th className="px-5 py-2.5 font-semibold">Status</th>
                          <th className="px-5 py-2.5 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0f3ed]">
                        {searchedPayments.map((payment) => {
                          const proofUrl = getSecureProofUrl(payment.receiptUrl);
                          return (
                            <tr
                              key={payment.id}
                              className="transition-colors hover:bg-[#fafcfb]"
                            >
                              <td className="px-5 py-3">
                                <p className="font-semibold text-[#0f2318]">
                                  {payment.user.name}
                                </p>
                                <p className="text-[10px] text-[#5a7267]">
                                  @{payment.user.username}
                                </p>
                              </td>
                              <td className="px-5 py-3 text-[#5a7267]">
                                {payment.loan?.name ?? "—"}
                                {payment.loan && (
                                  <span className="ml-1 rounded bg-gray-100 px-1 py-0.5 text-[9px] font-bold text-gray-500">
                                    {payment.loan.type}
                                  </span>
                                )}
                              </td>
                              <td
                                className="px-5 py-3 text-right font-semibold text-[#0f2318]"
                                style={{ fontFamily: "var(--font-mono)" }}
                              >
                                ₱{payment.amount.toLocaleString()}
                              </td>
                              <td className="px-5 py-3 text-[#5a7267]">
                                {new Date(payment.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-5 py-3">
                                <StatusBadge status={payment.status} />
                                {payment.rejectionReason && (
                                  <p className="mt-0.5 text-[10px] text-red-500">
                                    {payment.rejectionReason}
                                  </p>
                                )}
                              </td>
                              <td className="px-5 py-3 text-right">
                                <div className="flex justify-end gap-1.5">
                                  {proofUrl && (
                                    <button
                                      onClick={() => setProofModalUrl(proofUrl)}
                                      className="rounded-md border border-[#e2ebe6] px-2.5 py-1 text-[10px] font-semibold text-[#5a7267] transition-all hover:bg-[#f0f7eb]"
                                    >
                                      View
                                    </button>
                                  )}
                                  {payment.status === "PENDING" && (
                                    <>
                                      <button
                                        disabled={
                                          busy === payment.id || !proofUrl
                                        }
                                        onClick={() =>
                                          mutate(
                                            payment.id,
                                            `/api/admin/payments/${payment.id}`,
                                            { action: "verify" },
                                            "Payment verified.",
                                          )
                                        }
                                        className="rounded-md bg-[#1b5e3b] px-2.5 py-1 text-[10px] font-semibold text-white transition-all hover:bg-[#15503a] disabled:opacity-40"
                                      >
                                        Verify
                                      </button>
                                      <button
                                        disabled={busy === payment.id}
                                        onClick={() => {
                                          const reason = rejectReason();
                                          if (reason)
                                            void mutate(
                                              payment.id,
                                              `/api/admin/payments/${payment.id}`,
                                              { action: "reject", reason },
                                              "Payment rejected.",
                                            );
                                        }}
                                        className="rounded-md border border-red-200 px-2.5 py-1 text-[10px] font-semibold text-red-600 transition-all hover:bg-red-50 disabled:opacity-40"
                                      >
                                        Reject
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-5 py-12 text-center">
                    <Banknote size={32} className="mx-auto mb-2 text-[#dce5d9]" />
                    <p className="text-sm text-[#5a7267]">
                      No {paymentFilter === "ALL" ? "" : paymentFilter.toLowerCase() + " "}payments found.
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* ═══ OVERDUE TAB ═══ */}
            {tab === "overdue" && (
              <section className="rounded-xl border border-red-200 bg-white shadow-sm animate-fadeIn">
                <div className="border-b border-red-100 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-red-600" />
                    <div>
                      <h2
                        className="text-sm font-bold text-red-800"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        Overdue collection monitoring
                      </h2>
                      <p className="text-xs text-red-600">
                        {overdueLoans.length} loan{overdueLoans.length !== 1 ? "s" : ""} past due date
                      </p>
                    </div>
                  </div>
                </div>

                {overdueLoans.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-red-100 bg-red-50/50 text-[10px] uppercase tracking-wider text-red-700">
                          <th className="px-5 py-2.5 font-semibold">Member</th>
                          <th className="px-5 py-2.5 font-semibold">Loan</th>
                          <th className="px-5 py-2.5 font-semibold text-right">Amount</th>
                          <th className="px-5 py-2.5 font-semibold text-right">Remaining</th>
                          <th className="px-5 py-2.5 font-semibold">Due date</th>
                          <th className="px-5 py-2.5 font-semibold text-right">Days overdue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-50">
                        {overdueLoans.map((loan) => {
                          const days = Math.floor(
                            (now.getTime() - new Date(loan.due!).getTime()) /
                              (1000 * 60 * 60 * 24),
                          );
                          return (
                            <tr
                              key={loan.id}
                              className="transition-colors hover:bg-red-50/30"
                            >
                              <td className="px-5 py-3">
                                <p className="font-semibold text-[#0f2318]">
                                  {loan.borrower.name}
                                </p>
                                <p className="text-[10px] text-[#5a7267]">
                                  @{loan.borrower.username}
                                </p>
                              </td>
                              <td className="px-5 py-3">
                                <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                                  {loan.name}
                                </span>
                              </td>
                              <td
                                className="px-5 py-3 text-right font-semibold text-[#0f2318]"
                                style={{ fontFamily: "var(--font-mono)" }}
                              >
                                ₱{loan.amount.toLocaleString()}
                              </td>
                              <td
                                className="px-5 py-3 text-right text-red-600"
                                style={{ fontFamily: "var(--font-mono)" }}
                              >
                                ₱{loan.remainingBalance.toLocaleString()}
                              </td>
                              <td className="px-5 py-3 text-[#5a7267]">
                                {new Date(loan.due!).toLocaleDateString()}
                              </td>
                              <td className="px-5 py-3 text-right">
                                <span
                                  className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-bold text-red-700"
                                  style={{ fontFamily: "var(--font-mono)" }}
                                >
                                  <ArrowUpRight size={10} />
                                  {days} day{days !== 1 ? "s" : ""}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-5 py-12 text-center">
                    <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
                    <p className="text-sm text-[#5a7267]">
                      No overdue loans. All collections are on track.
                    </p>
                  </div>
                )}
              </section>
            )}
          </div>

          {/* ── Right: Activity sidebar ── */}
          <aside className="space-y-6">
            {/* Summary panel */}
            <div className="rounded-xl border border-[#e2ebe6] bg-white shadow-sm">
              <div className="border-b border-[#f0f3ed] px-4 py-3">
                <h3
                  className="text-xs font-bold text-[#0f2318]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Quick summary
                </h3>
              </div>
              <div className="divide-y divide-[#f0f3ed]">
                {stats && (
                  <>
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs text-[#5a7267]">Total loans</span>
                      <span
                        className="text-sm font-bold text-[#0f2318]"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {stats.totalLoans}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs text-[#5a7267]">Total payments</span>
                      <span
                        className="text-sm font-bold text-[#0f2318]"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {stats.totalPayments}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs text-[#5a7267]">Collection rate</span>
                      <span
                        className="text-sm font-bold text-emerald-600"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {stats.outstanding > 0
                          ? `${Math.round(((stats.totalReceived / (stats.totalReceived + stats.outstanding)) * 100))}%`
                          : "100%"}
                      </span>
                    </div>
                    {overdueLoans.length > 0 && (
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-xs text-red-600">Overdue amount</span>
                        <span
                          className="text-sm font-bold text-red-600"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          ₱{overdueLoans
                            .reduce((s, l) => s + l.remainingBalance, 0)
                            .toLocaleString()}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Activity feed */}
            <div className="rounded-xl border border-[#e2ebe6] bg-white shadow-sm">
              <div className="border-b border-[#f0f3ed] px-4 py-3">
                <h3
                  className="text-xs font-bold text-[#0f2318]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Recent activity
                </h3>
              </div>
              {recentActivity.length > 0 ? (
                <div className="divide-y divide-[#f0f3ed]">
                  {recentActivity.map((item) => (
                    <div key={item.id} className="px-4 py-2.5">
                      <p className="text-xs text-[#0f2318] leading-relaxed">
                        {item.text}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[#5a7267]">
                        {item.time}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-[#5a7267]">No recent activity.</p>
                </div>
              )}
            </div>

            {/* Reminders */}
            <div className="rounded-xl border border-[#e2ebe6] bg-white shadow-sm">
              <div className="border-b border-[#f0f3ed] px-4 py-3">
                <h3
                  className="text-xs font-bold text-[#0f2318]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Today&apos;s priorities
                </h3>
              </div>
              <div className="space-y-2 px-4 py-3">
                {stats && stats.pendingLoans > 0 && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2">
                    <FileText size={13} className="mt-0.5 text-amber-600" />
                    <p className="text-xs text-amber-800">
                      Review {stats.pendingLoans} pending loan request{stats.pendingLoans !== 1 ? "s" : ""}
                    </p>
                  </div>
                )}
                {stats && stats.pendingPayments > 0 && (
                  <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2">
                    <Banknote size={13} className="mt-0.5 text-blue-600" />
                    <p className="text-xs text-blue-800">
                      Verify {stats.pendingPayments} payment submission{stats.pendingPayments !== 1 ? "s" : ""}
                    </p>
                  </div>
                )}
                {stats && stats.overdue > 0 && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2">
                    <AlertTriangle size={13} className="mt-0.5 text-red-600" />
                    <p className="text-xs text-red-800">
                      Follow up on {stats.overdue} overdue loan{stats.overdue !== 1 ? "s" : ""}
                    </p>
                  </div>
                )}
                {stats &&
                  stats.pendingLoans === 0 &&
                  stats.pendingPayments === 0 &&
                  stats.overdue === 0 && (
                    <div className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2">
                      <CheckCircle2 size={13} className="mt-0.5 text-emerald-600" />
                      <p className="text-xs text-emerald-800">
                        All caught up. No urgent items today.
                      </p>
                    </div>
                  )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {proofModalUrl && (
        <ImageModal
          src={proofModalUrl}
          alt="Proof of payment"
          onClose={() => setProofModalUrl(null)}
        />
      )}
    </div>
  );
}
