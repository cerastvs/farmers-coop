"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Money } from "@/components/Money";
import { ArrowRight } from "lucide-react";

interface ApplyLoanCardProps {
  currentBalance: number | null;
  hasGuarantor?: boolean | null;
  guarantorStatus?: string | null;
  hasPendingRequest?: boolean;
  isLoading: boolean;
  onSubmitted?: () => void;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function ApplyLoanCard({ currentBalance, hasGuarantor, guarantorStatus, hasPendingRequest, isLoading, onSubmitted }: ApplyLoanCardProps) {
  const hasBalance = currentBalance !== null && currentBalance > 0;
  const missingGuarantor = hasGuarantor !== null && hasGuarantor === false;
  const guarantorPending = guarantorStatus === "PENDING";
  const guarantorRejected = guarantorStatus === "REJECTED";
  const blocked = hasBalance || missingGuarantor || !!hasPendingRequest;
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [interestRate, setInterestRate] = useState<number>(2);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/settings/loan-interest");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && typeof data.rate === "number") {
            setInterestRate(data.rate);
          }
        }
      } catch {
        // keep the default rate when the fetch fails
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const principal = useMemo(() => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0) return 0;
    return roundMoney(value);
  }, [amount]);

  const totalPayable = useMemo(
    () => roundMoney(principal * (1 + interestRate / 100)),
    [principal, interestRate],
  );
  const interestAmount = roundMoney(totalPayable - principal);

  async function submitLoan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmitting(true);
    setMessage(null);

    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(form.get("amount")),
          termMonths: Number(form.get("termMonths")),
          purpose: form.get("purpose"),
          type: "MONEY",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? data.message ?? "Unable to submit loan request");
      setMessage({ kind: "success", text: data.message ?? "Loan request submitted for review." });
      formElement.reset();
      setAmount("");
      onSubmitted?.();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Unable to submit loan request" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md md:max-w-2xl mx-auto bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b">
        <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-green-100 text-green-700 text-xl font-bold">
          ₱
        </div>
        <div>
          <h2 className="font-semibold text-lg">Cash Loan</h2>
          <p className="text-sm text-gray-500">
            Apply for loans with flexible payment terms
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-100/60 rounded-xl p-4">
            <p className="text-sm text-gray-600">Maximum Loan Amount</p>
            <p className="text-2xl font-bold text-green-700">₱5,000</p>
          </div>

          <div className="bg-blue-100/60 rounded-xl p-4">
            <p className="text-sm text-gray-600">Current Loan Balance</p>
            <p className="text-2xl font-bold text-blue-700">
              {isLoading ? "..." : <Money value={currentBalance || 0} />}
            </p>
          </div>
        </div>

        <div className="bg-purple-100/60 rounded-xl p-4">
          <p className="text-sm text-gray-600">Payment Terms</p>
          <p className="text-2xl font-bold text-purple-600">6–24 months</p>
        </div>

        <Link
          href="/dashboard/supplies"
          className="flex items-center justify-between gap-3 rounded-xl border border-[#cfe3b8] bg-[#f1f8e8] p-4 transition hover:bg-[#e6f4d8]"
        >
          <div>
            <p className="text-sm font-bold text-[#2d6a2d]">
              Looking for a supply loan?
            </p>
            <p className="mt-0.5 text-sm text-gray-600">
              Apply for a supply loan on the Supply page instead.
            </p>
          </div>
          <ArrowRight size={18} className="shrink-0 text-[#2d6a2d]" />
        </Link>

        <form className="space-y-4 border-t border-gray-100 pt-4" onSubmit={submitLoan}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-gray-700">
              Amount
              <input
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                name="amount"
                type="number"
                min="1"
                max="5000"
                step="0.01"
                placeholder="Up to ₱5,000"
                required
                disabled={blocked}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            {principal > 0 && !blocked && interestRate > 0 && (
              <div className="sm:col-span-2 rounded-xl border border-green-200 bg-green-50 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Total payable
                  </span>
                  <span className="text-lg font-bold text-green-700">
                    <Money value={totalPayable} />
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  <Money value={principal} /> principal plus <Money value={interestAmount} /> flat interest at {interestRate}%
                </p>
                <p className="text-[11px] font-mono text-gray-500">
                  Formula: Total = Amount × (1 + {interestRate}%) = <Money value={principal} /> × {1 + interestRate / 100} = <Money value={totalPayable} />
                </p>
              </div>
            )}
            <label className="text-sm font-semibold text-gray-700">
              Payment term
              <select
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                name="termMonths"
                defaultValue="6"
                disabled={blocked}
              >
                {[6, 9, 12, 18, 24].map((months) => (
                  <option value={months} key={months}>{months} months</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm font-semibold text-gray-700">
            Loan purpose
            <textarea
              className="mt-1.5 min-h-24 w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
              name="purpose"
              minLength={10}
              maxLength={500}
              placeholder="Describe how this loan will support your farm."
              required
              disabled={blocked}
            />
          </label>
          {message && (
            <p
              aria-live="polite"
              className={`rounded-xl px-3 py-2 text-sm ${message.kind === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
            >
              {message.text}
            </p>
          )}
          {guarantorRejected ? (
            <Link
              href="/registration?focus=guarantor"
              className="w-full rounded-xl bg-red-700 px-6 py-3 text-center font-medium text-white transition hover:bg-red-800 md:w-auto"
            >
              Update Guarantor
            </Link>
          ) : (
            <button
              type="submit"
              disabled={blocked || submitting || isLoading}
              className={`w-full rounded-xl px-6 py-3 font-medium transition md:w-auto ${
                blocked || submitting || isLoading
                  ? "cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400"
                  : "bg-green-700 text-white hover:bg-green-800"
              }`}
            >
              {blocked
                ? guarantorPending
                  ? "Guarantor Approval Pending"
                  : missingGuarantor
                    ? "Add Your Guarantor"
                    : hasPendingRequest
                      ? "Request Under Review"
                      : "Settlement Required"
                : submitting
                  ? "Submitting…"
                  : "Submit Loan Request"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
