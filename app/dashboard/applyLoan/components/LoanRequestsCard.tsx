"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { Money } from "@/components/Money";
import { IconInfoCircle } from "@/components/icons";

export type LoanRequest = {
  id: string;
  name: string;
  type: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "ACTIVE" | "OVERDUE" | "PAID";
  amount: number;
  remainingBalance: number;
  due: string;
  createdAt: string;
  termMonths: number;
  purpose: string | null;
  rejectionReason: string | null;
};

const STATUS_STYLES: Record<
  LoanRequest["status"],
  { label: string; className: string }
> = {
  PENDING: {
    label: "Pending review",
    className: "bg-amber-100 text-amber-700",
  },
  APPROVED: {
    label: "Approved",
    className: "bg-blue-100 text-blue-700",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-red-100 text-red-700",
  },
  ACTIVE: {
    label: "Active",
    className: "bg-green-100 text-green-700",
  },
  OVERDUE: {
    label: "Overdue",
    className: "bg-red-100 text-red-700",
  },
  PAID: {
    label: "Settled",
    className: "bg-gray-100 text-gray-600",
  },
};

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString("en-PH", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function CancelLoanModal({
  loan,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  loan: LoanRequest;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white shadow-2xl animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[#e2ebe6] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-100 text-red-600">
              <AlertTriangle size={18} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-[#0f2318]">
                Cancel loan request?
              </h3>
              <p className="text-[11px] text-[#5a7267]">
                This request will be withdrawn permanently.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1.5 text-[#5a7267] transition hover:bg-gray-100 disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-2xl border border-[#e2e7dc] bg-[#f7faf5] p-4">
            <p className="font-bold text-[#173a2b]">{loan.name}</p>
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs font-medium text-[#718176]">Amount</p>
                <p className="font-bold text-[#315646]">
                  <Money value={loan.amount} />
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[#718176]">Term</p>
                <p className="font-bold text-[#315646]">
                  {loan.termMonths} months
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
              <AlertTriangle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Keep Request
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {busy ? "Cancelling…" : "Yes, Cancel Request"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function LoanRequestsCard({
  loans,
  onCancelled,
}: {
  loans: LoanRequest[];
  onCancelled?: () => void;
}) {
  const [confirming, setConfirming] = useState<LoanRequest | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loans.length === 0) return null;

  async function cancelRequest(loan: LoanRequest) {
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(`/api/loans/${loan.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.error ?? data?.message ?? "Unable to cancel loan request",
        );
      }
      setConfirming(null);
      onCancelled?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cancel loan request");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900">
        Your Loan Requests
      </h2>
      {loans.map((loan) => {
        const style = STATUS_STYLES[loan.status] ?? STATUS_STYLES.PENDING;
        return (
          <div
            key={loan.id}
            className="rounded-2xl border border-[#e2e7dc] bg-white p-5 shadow-sm shadow-[#173a2b]/[.03]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold text-[#173a2b]">{loan.name}</p>
                <p className="text-xs text-[#718176]">
                  Submitted {formatDate(loan.createdAt)}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${style.className}`}
              >
                {style.label}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs font-medium text-[#718176]">Amount</p>
                <p className="font-bold text-[#315646]">
                  <Money value={loan.amount} />
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[#718176]">Term</p>
                <p className="font-bold text-[#315646]">
                  {loan.termMonths} months
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[#718176]">Due</p>
                <p className="font-bold text-[#315646]">
                  {formatDate(loan.due)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[#718176]">
                  Remaining Balance
                </p>
                <p className="font-bold text-[#315646]">
                  <Money value={loan.remainingBalance} />
                </p>
              </div>
            </div>

            {loan.purpose && (
              <p className="mt-3 rounded-xl bg-[#f7faf5] px-3 py-2 text-sm text-[#315646]">
                {loan.purpose}
              </p>
            )}

            {loan.status === "PENDING" && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2">
                <p className="flex items-start gap-2 text-xs font-semibold text-amber-700">
                  <IconInfoCircle className="mt-0.5 w-4 h-4 shrink-0" />
                  <span>
                    Your request is under review. You&apos;ll be notified once
                    the cooperative decides. You can&apos;t submit another
                    request while this is pending.
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setConfirming(loan);
                  }}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-700 transition hover:bg-amber-100"
                >
                  Cancel Request
                </button>
              </div>
            )}

            {loan.status === "REJECTED" && (
              <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                <p className="font-bold">Rejected</p>
                <p className="mt-0.5">
                  {loan.rejectionReason ||
                    "The cooperative did not approve this request. You can submit a new one."}
                </p>
              </div>
            )}
          </div>
        );
      })}

      {confirming && (
        <CancelLoanModal
          loan={confirming}
          busy={cancelling}
          error={error}
          onClose={() => {
            if (!cancelling) setConfirming(null);
          }}
          onConfirm={() => cancelRequest(confirming)}
        />
      )}
    </div>
  );
}