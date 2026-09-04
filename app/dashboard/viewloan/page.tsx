"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ImageModal } from "@/components/ImageModal";
import { DashboardHeader } from "../components/DashboardHeader";
import { LoanCard } from "./components/LoanCard";
import { PaymentHistoryTable } from "./components/PaymentHistoryTable";
import { IconChevronLeft } from "@/components/icons";
import { Money } from "@/components/Money";

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
  receiptUrl: string | null;
  referenceNo: string | null;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  rejectionReason?: string | null;
  createdAt: string;
  loan?: { name: string } | null;
}

const MAX_PROOF_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_PROOF_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getSecureProofUrl(receiptUrl: string | null) {
  if (!receiptUrl) return null;

  try {
    const url = new URL(receiptUrl);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export default function ViewLoanPage() {
  const [loans, setLoans] = useState<LoanData[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [proofModalUrl, setProofModalUrl] = useState<string | null>(null);

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
    const proofOfPayment = form.get("proofOfPayment");

    if (!(proofOfPayment instanceof File) || proofOfPayment.size === 0) {
      setMessage({ kind: "error", text: "Choose a proof-of-payment image." });
      setSubmitting(false);
      return;
    }
    if (!ACCEPTED_PROOF_TYPES.has(proofOfPayment.type)) {
      setMessage({ kind: "error", text: "Use a JPEG, PNG, or WebP image." });
      setSubmitting(false);
      return;
    }
    if (proofOfPayment.size > MAX_PROOF_SIZE_BYTES) {
      setMessage({ kind: "error", text: "The proof image must be 5 MB or smaller." });
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        body: form,
      });
      const data = await response.json().catch(() => ({}));
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
                  amount: <Money value={loan.amount} />,
                  remainingBalance: <Money value={loan.remainingBalance} />,
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
            <p className="mt-1 text-sm text-gray-500">Upload a clear image of your bank, e-wallet, or cooperative payment receipt.</p>
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
                Proof of payment
                <input
                  name="proofOfPayment"
                  required
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-green-50 file:px-3 file:py-1.5 file:font-semibold file:text-green-700"
                />
                <span className="mt-1 block text-xs font-normal text-gray-500">
                  JPEG, PNG, or WebP. Maximum file size: 5 MB.
                </span>
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
            ) : submissions.map((payment) => {
              const proofUrl = getSecureProofUrl(payment.receiptUrl);
              const legacyReference = payment.referenceNo?.trim();
              return (
                <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{payment.loan?.name ?? "Loan payment"} · <Money value={payment.amount} /></p>
                    <p className="text-xs text-gray-500">{new Date(payment.createdAt).toLocaleDateString()}</p>
                    {proofUrl ? (
                      <button
                        onClick={() => setProofModalUrl(proofUrl)}
                        className="group mt-1 inline-block overflow-hidden rounded-xl border border-gray-200"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={proofUrl}
                          alt="Proof of payment"
                          className="h-24 w-24 rounded-xl object-cover transition group-hover:opacity-80"
                        />
                      </button>
                    ) : legacyReference ? (
                      <p className="mt-1 text-xs text-gray-500">Legacy reference: {legacyReference}</p>
                    ) : (
                      <p className="mt-1 text-xs font-semibold text-amber-700">Missing payment evidence</p>
                    )}
                    {payment.rejectionReason && <p className="mt-1 text-xs text-red-600">{payment.rejectionReason}</p>}
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    payment.status === "VERIFIED" ? "bg-green-100 text-green-700" : payment.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                  }`}>{payment.status}</span>
                </div>
              );
            })}
          </div>
        </section>

        <PaymentHistoryTable 
          records={paymentHistory.map(p => ({
            ...p,
            amount: <Money value={p.amount} />,
            paidAt: new Date(p.paidAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          }))} 
        />

        <div className="h-4" />
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
