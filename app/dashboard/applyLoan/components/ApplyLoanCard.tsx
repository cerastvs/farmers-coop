"use client";

import { FormEvent, useState } from "react";
import { Money } from "@/components/Money";

interface ApplyLoanCardProps {
  currentBalance: number | null;
  isLoading: boolean;
}

export function ApplyLoanCard({ currentBalance, isLoading }: ApplyLoanCardProps) {
  const hasBalance = currentBalance !== null && currentBalance > 0;
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

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
          type: form.get("type"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? data.message ?? "Unable to submit loan request");
      setMessage({ kind: "success", text: data.message ?? "Loan request submitted for review." });
      formElement.reset();
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

        <form className="space-y-4 border-t border-gray-100 pt-4" onSubmit={submitLoan}>
          <label className="block text-sm font-semibold text-gray-700">
            Loan Type
            <select
              className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
              name="type"
              defaultValue="MONEY"
              disabled={hasBalance}
            >
              <option value="MONEY">Money Loan</option>
              <option value="SUPPLY">Supply Loan</option>
            </select>
          </label>
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
                disabled={hasBalance}
              />
            </label>
            <label className="text-sm font-semibold text-gray-700">
              Payment term
              <select
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                name="termMonths"
                defaultValue="6"
                disabled={hasBalance}
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
              disabled={hasBalance}
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
          <button
            type="submit"
            disabled={hasBalance || submitting || isLoading}
            className={`w-full rounded-xl px-6 py-3 font-medium transition md:w-auto ${
              hasBalance || submitting || isLoading
                ? "cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400"
                : "bg-green-700 text-white hover:bg-green-800"
            }`}
          >
            {hasBalance ? "Settlement Required" : submitting ? "Submitting…" : "Submit Loan Request"}
          </button>
        </form>
      </div>
    </div>
  );
}
