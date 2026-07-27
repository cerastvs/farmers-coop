"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ImageModal } from "@/components/ImageModal";
import { DashboardHeader } from "../components/DashboardHeader";

type Tab = "loans" | "payments" | "overdue";
type LoanType = "SUPPLY" | "MONEY";
type LoanTab = "requests" | "payments" | "overdue";
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

const buttonClass = "rounded-xl bg-[#26633f] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#174b36] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "rounded-xl border border-[#cddbc9] bg-white px-3.5 py-2 text-xs font-bold text-[#315646] transition hover:bg-[#f0f7eb] disabled:opacity-50";

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
  if (!response.ok) throw new Error(data.error ?? data.message ?? "Request failed");
  return data;
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-600",
  ACTIVE: "bg-blue-100 text-blue-700",
  PAID: "bg-gray-100 text-gray-500",
  VERIFIED: "bg-green-100 text-green-700",
  COMPLETED: "bg-green-100 text-green-700",
};

export default function TreasurerPage() {
  const [data, setData] = useState<TreasurerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [tab, setTab] = useState<Tab>("loans");
  const [proofModalUrl, setProofModalUrl] = useState<string | null>(null);

  // Loans sub-state
  const [loanType, setLoanType] = useState<LoanType>("MONEY");
  const [loanTab, setLoanTab] = useState<LoanTab>("requests");
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

  useEffect(() => { fetchData(); }, [fetchData]);

  async function mutate(key: string, url: string, body: unknown, success: string, method = "PATCH") {
    setBusy(key);
    setNotice(null);
    try {
      const result = await requestJson(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setNotice({ kind: "success", text: success });
      await fetchData();
      return result;
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Action failed" });
    } finally {
      setBusy(null);
    }
  }

  function rejectReason() {
    return window.prompt("Enter the reason for rejection:");
  }

  const now = useMemo(() => new Date(), []);

  const filteredLoans = useMemo(() => {
    if (!data) return [];
    return data.loans.filter((l) => l.type === loanType);
  }, [data, loanType]);

  const loanRequests = useMemo(() => filteredLoans.filter((l) => l.status === "PENDING"), [filteredLoans]);
  const loanActive = useMemo(() => filteredLoans.filter((l) => l.status === "APPROVED" || l.status === "ACTIVE"), [filteredLoans]);
  const loanOverdue = useMemo(
    () => filteredLoans.filter((l) => l.status === "ACTIVE" && l.due && new Date(l.due) < now),
    [filteredLoans, now],
  );

  const currentLoans = loanTab === "requests" ? loanRequests : loanTab === "payments" ? loanActive : loanOverdue;

  const pendingPayments = useMemo(() => data?.payments.filter((p) => p.status === "PENDING") ?? [], [data]);
  const filteredPayments = useMemo(() => {
    if (!data) return [];
    if (paymentFilter === "ALL") return data.payments;
    return data.payments.filter((p) => p.status === paymentFilter);
  }, [data, paymentFilter]);

  const overdueLoans = useMemo(
    () => data?.loans.filter((l) => l.status === "ACTIVE" && l.due && new Date(l.due) < now) ?? [],
    [data, now],
  );

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f7f2] text-sm font-semibold text-[#315646]">
        Loading treasurer dashboard…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f2]">
      <DashboardHeader />

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-2">
          <h1 className="text-xl font-black text-[#173a2b]">Treasurer Dashboard</h1>
          <p className="text-sm text-[#718176]">Manage loans, payments, and financial records</p>
        </div>

        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {(["loans", "payments", "overdue"] as const).map((item) => (
            <button
              key={item}
              onClick={() => { setTab(item); setNotice(null); }}
              className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold capitalize ${tab === item ? "bg-[#26633f] text-white" : "border border-[#dce5d9] bg-white text-[#496558]"}`}
            >
              {item}
              {item === "overdue" && overdueLoans.length > 0 && (
                <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">{overdueLoans.length}</span>
              )}
            </button>
          ))}
        </div>

        {notice && (
          <p aria-live="polite" className={`mb-5 rounded-xl px-4 py-3 text-sm ${notice.kind === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {notice.text}
          </p>
        )}

        {tab === "loans" && (
          <section className="rounded-3xl border border-[#dce5d9] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-black text-[#173a2b]">Loan Requests</h2>
                <p className="text-sm text-[#718176]">Review and approve loan applications</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setLoanType("MONEY")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${loanType === "MONEY" ? "bg-[#173a2b] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                >
                  Money Loans
                </button>
                <button
                  onClick={() => setLoanType("SUPPLY")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${loanType === "SUPPLY" ? "bg-[#173a2b] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                >
                  Supply Loans
                </button>
              </div>
            </div>

            <div className="flex gap-1 mb-4">
              {(["requests", "payments", "overdue"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setLoanTab(t)}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition capitalize ${loanTab === t ? "bg-[#173a2b] text-white" : "bg-gray-50 text-gray-400 hover:bg-gray-100"}`}
                >
                  {t} ({t === "requests" ? loanRequests.length : t === "payments" ? loanActive.length : loanOverdue.length})
                </button>
              ))}
            </div>

            {currentLoans.length > 0 ? (
              <div className="space-y-3">
                {currentLoans.map((loan) => (
                  <article key={loan.id} className="rounded-2xl border border-[#e3e9e0] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-extrabold text-[#173a2b]">{loan.borrower.name}</h3>
                        <p className="text-xs text-[#718176]">
                          {loan.name} · ₱{loan.amount.toLocaleString()} · {loan.termMonths} months
                          {loan.due && ` · Due ${new Date(loan.due).toLocaleDateString()}`}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${STATUS_STYLE[loan.status] || "bg-gray-100 text-gray-500"}`}>
                        {loan.status}
                      </span>
                    </div>
                    {loan.purpose && <p className="mt-2 text-sm text-[#596d61]">{loan.purpose}</p>}
                    {loan.rejectionReason && <p className="mt-1 text-xs text-red-600">Reason: {loan.rejectionReason}</p>}
                    {loan.status === "PENDING" && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        <button
                          disabled={busy === loan.id}
                          onClick={() => mutate(loan.id, `/api/admin/loans/${loan.id}`, { action: "approve" }, "Loan approved and activated.")}
                          className={buttonClass}
                        >
                          Approve
                        </button>
                        <button
                          disabled={busy === loan.id}
                          onClick={() => {
                            const reason = rejectReason();
                            if (reason) void mutate(loan.id, `/api/admin/loans/${loan.id}`, { action: "reject", reason }, "Loan rejected.");
                          }}
                          className={secondaryButton}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-[#f7faf5] p-8 text-center text-sm text-[#718176]">
                No {loanType === "SUPPLY" ? "supply" : "money"} {loanTab} found.
              </p>
            )}
          </section>
        )}

        {tab === "payments" && (
          <section className="rounded-3xl border border-[#dce5d9] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-black text-[#173a2b]">Payment History</h2>
                <p className="text-sm text-[#718176]">All payment submissions and their verification status</p>
              </div>
              <div className="flex gap-1">
                {(["ALL", "PENDING", "VERIFIED", "REJECTED"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setPaymentFilter(f)}
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${paymentFilter === f ? "bg-[#173a2b] text-white" : "bg-gray-50 text-gray-400 hover:bg-gray-100"}`}
                  >
                    {f} ({f === "ALL" ? data?.payments.length ?? 0 : data?.payments.filter((p) => p.status === f).length ?? 0})
                  </button>
                ))}
              </div>
            </div>

            {pendingPayments.length > 0 && paymentFilter === "ALL" && (
              <div className="mb-5">
                <h3 className="text-sm font-bold text-amber-700 mb-3 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Pending Verification ({pendingPayments.length})
                </h3>
                <div className="space-y-3">
                  {pendingPayments.map((payment) => {
                    const proofUrl = getSecureProofUrl(payment.receiptUrl);
                    const legacyReference = payment.referenceNo?.trim();
                    const hasPaymentEvidence = Boolean(proofUrl || legacyReference);

                    return (
                      <article key={payment.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h3 className="font-extrabold text-[#173a2b]">{payment.user.name}</h3>
                            <p className="text-xs text-[#718176]">
                              ₱{payment.amount.toLocaleString()} · {payment.loan?.name ?? "Loan payment"} · {new Date(payment.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-[11px] font-black text-yellow-700">PENDING</span>
                        </div>

                        {proofUrl ? (
                          <button
                            onClick={() => setProofModalUrl(proofUrl)}
                            className="group mt-2 inline-block overflow-hidden rounded-xl border border-[#dce5d9]"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={proofUrl}
                              alt="Proof of payment"
                              className="h-24 w-24 rounded-xl object-cover transition group-hover:opacity-80"
                            />
                          </button>
                        ) : legacyReference ? (
                          <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#496558]">
                            Reference: {legacyReference}
                          </p>
                        ) : (
                          <p className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800">
                            Missing payment evidence
                          </p>
                        )}

                        <div className="flex flex-wrap gap-2 pt-2">
                          <button
                            disabled={busy === payment.id || !hasPaymentEvidence}
                            onClick={() => mutate(payment.id, `/api/admin/payments/${payment.id}`, { action: "verify" }, "Payment verified.")}
                            className={buttonClass}
                          >
                            Verify
                          </button>
                          <button
                            disabled={busy === payment.id}
                            onClick={() => {
                              const reason = rejectReason();
                              if (reason) void mutate(payment.id, `/api/admin/payments/${payment.id}`, { action: "reject", reason }, "Payment rejected.");
                            }}
                            className={secondaryButton}
                          >
                            Reject
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredPayments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#e3e9e0] text-[10px] uppercase tracking-wider text-[#718176]">
                      <th className="pb-2 pr-3 font-bold">Member</th>
                      <th className="pb-2 pr-3 font-bold">Loan Type</th>
                      <th className="pb-2 pr-3 font-bold text-right">Amount</th>
                      <th className="pb-2 pr-3 font-bold">Date</th>
                      <th className="pb-2 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="border-b border-[#f0f3ed] hover:bg-[#f7faf5] transition-colors"
                      >
                        <td className="py-2.5 pr-3">
                          <p className="font-semibold text-[#173a2b]">{payment.user.name}</p>
                          <p className="text-[10px] text-[#718176]">@{payment.user.username}</p>
                        </td>
                        <td className="py-2.5 pr-3 text-[#596d61]">
                          {payment.loan?.name ?? "—"}
                          {payment.loan && (
                            <span className="ml-1 rounded bg-gray-100 px-1 py-0.5 text-[9px] font-bold text-gray-500">
                              {payment.loan.type}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-bold text-[#173a2b]">
                          ₱{payment.amount.toLocaleString()}
                        </td>
                        <td className="py-2.5 pr-3 text-[#718176]">
                          {new Date(payment.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[payment.status] || "bg-gray-100 text-gray-500"}`}>
                            {payment.status}
                          </span>
                          {payment.rejectionReason && (
                            <p className="mt-0.5 text-[10px] text-red-500">{payment.rejectionReason}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-2xl bg-[#f7faf5] p-8 text-center text-sm text-[#718176]">
                No {paymentFilter === "ALL" ? "" : paymentFilter.toLowerCase() + " "}payments found.
              </p>
            )}
          </section>
        )}

        {tab === "overdue" && (
          <section className="rounded-3xl border border-[#dce5d9] bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-black text-[#173a2b]">Overdue Loans</h2>
            <p className="mb-5 text-sm text-[#718176]">Loans past their due date that require attention</p>

            {overdueLoans.length > 0 ? (
              <div className="space-y-3">
                {overdueLoans.map((loan) => {
                  const daysOverdue = Math.floor((now.getTime() - new Date(loan.due!).getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <article key={loan.id} className="rounded-2xl border border-red-200 bg-red-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="font-extrabold text-[#173a2b]">{loan.borrower.name}</h3>
                          <p className="text-xs text-[#718176]">
                            {loan.name} · ₱{loan.amount.toLocaleString()} · {loan.termMonths} months
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-black text-red-600">
                            {daysOverdue} day{daysOverdue !== 1 ? "s" : ""} overdue
                          </span>
                          <p className="text-xs text-[#718176] mt-1">
                            Due: {new Date(loan.due!).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {loan.purpose && <p className="mt-2 text-sm text-[#596d61]">{loan.purpose}</p>}
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-2xl bg-[#f7faf5] p-8 text-center text-sm text-[#718176]">No overdue loans.</p>
            )}
          </section>
        )}
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
