"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "../components/DashboardHeader";
import { LoanCard } from "./components/LoanCard";
import { PaymentHistoryTable } from "./components/PaymentHistoryTable";
import { IconChevronLeft } from "@/components/icons";

interface LoanData {
  id: string;
  name: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "ACTIVE" | "PAID";
  amount: number;
  remainingBalance: number;
  due: string;
}

interface PaymentRecord {
  receiptNo: string | null;
  paidAt: string;
  amount: number;
  loanName: string;
}

interface PaymentSubmission {
  id: string;
  loanId: string | null;
  amount: number;
  referenceNo: string | null;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  rejectionReason?: string | null;
  createdAt: string;
  loan?: { name: string } | null;
}

export default function ViewLoanPage() {
  const [loans, setLoans] = useState<LoanData[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [loanResponse, paymentResponse] = await Promise.all([
        fetch("/api/loans"),
        fetch("/api/payments"),
      ]);
      if (loanResponse.ok) {
        const data = await loanResponse.json();
        setLoans(data.loans);
        setPaymentHistory(data.paymentHistory);
      }
      if (paymentResponse.ok) setSubmissions(await paymentResponse.json());
    } catch (error) {
      console.error("Failed to fetch loan data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmitting(true);
    setMessage(null);
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanId: form.get("loanId"),
          amount: Number(form.get("amount")),
          referenceNo: form.get("referenceNo"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? data.message ?? "Unable to submit payment");
      setMessage({ kind: "success", text: data.message ?? "Payment submitted for verification." });
      formElement.reset();
      await fetchData();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Unable to submit payment" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <DashboardHeader />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-6">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-[#2d6a2d] font-medium mb-3 hover:underline"
          >
            <IconChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Loan Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track and manage your loan accounts
          </p>
        </div>

        <div className="space-y-4">
          {loans.length > 0 ? (
            loans.map((loan) => (
              <LoanCard 
                key={loan.id} 
                loan={{
                  ...loan,
                  amount: `₱${loan.amount.toLocaleString()}`,
                  remainingBalance: `₱${loan.remainingBalance.toLocaleString()}`,
                  due: new Date(loan.due).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                }} 
              />
            ))
          ) : (
            <div className="bg-white p-8 rounded-xl border border-gray-100 text-center text-gray-500">
              No loan records found.
            </div>
          )}
        </div>

        {loans.some((loan) => loan.status === "ACTIVE") && (
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-gray-800">Submit a Payment</h2>
            <p className="mt-1 text-sm text-gray-500">Enter the reference number from your bank, e-wallet, or cooperative receipt.</p>
            <form onSubmit={submitPayment} className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-semibold text-gray-700">
                Loan
                <select name="loanId" required className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                  {loans.filter((loan) => loan.status === "ACTIVE").map((loan) => (
                    <option value={loan.id} key={loan.id}>
                      {loan.name} · ₱{loan.remainingBalance.toLocaleString()}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-gray-700">
                Amount
                <input name="amount" required type="number" min="0.01" step="0.01" className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5" />
              </label>
              <label className="text-sm font-semibold text-gray-700">
                Reference number
                <input name="referenceNo" required minLength={3} maxLength={100} className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5" />
              </label>
              <div className="sm:col-span-3 flex flex-wrap items-center gap-3">
                <button disabled={submitting} className="rounded-xl bg-green-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                  {submitting ? "Submitting…" : "Submit for Verification"}
                </button>
                {message && (
                  <p aria-live="polite" className={`text-sm ${message.kind === "success" ? "text-green-700" : "text-red-700"}`}>
                    {message.text}
                  </p>
                )}
              </div>
            </form>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-base font-bold text-gray-800">Payment Submissions</h2>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {submissions.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400">No payment submissions yet.</p>
            ) : submissions.map((payment) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{payment.loan?.name ?? "Loan payment"} · ₱{payment.amount.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Ref: {payment.referenceNo ?? "—"} · {new Date(payment.createdAt).toLocaleDateString()}</p>
                  {payment.rejectionReason && <p className="mt-1 text-xs text-red-600">{payment.rejectionReason}</p>}
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  payment.status === "VERIFIED" ? "bg-green-100 text-green-700" : payment.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                }`}>{payment.status}</span>
              </div>
            ))}
          </div>
        </section>

        <PaymentHistoryTable 
          records={paymentHistory.map(p => ({
            ...p,
            amount: `₱${p.amount.toLocaleString()}`,
            paidAt: new Date(p.paidAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          }))} 
        />

        <div className="h-4" />
      </main>
    </div>
  );
}
