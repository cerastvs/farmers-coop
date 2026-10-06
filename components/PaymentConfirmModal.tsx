"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Money } from "@/components/Money";

export function PaymentConfirmModal({
  title,
  memberName,
  amount,
  detail,
  message,
  confirmLabel,
  reject,
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  memberName: string;
  amount: number;
  detail?: string;
  message: string;
  confirmLabel: string;
  reject?: boolean;
  busy?: boolean;
  onConfirm: (reason?: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#102a23]/65 p-3 backdrop-blur-sm sm:p-5"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-confirm-title"
        className="w-full max-w-md rounded-xl border border-[#d5e1d8] bg-[#fbfdfb] p-5 shadow-[0_24px_80px_rgba(16,42,35,0.24)] sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div
            className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg ${
              reject ? "bg-red-50" : "bg-[#f0f7eb]"
            }`}
          >
            {reject ? <XCircle size={22} className="text-red-600" /> : <CheckCircle2 size={22} className="text-[#1b5e3b]" />}
          </div>
          <p className={`mb-1 text-sm font-black ${reject ? "text-red-600" : "text-[#1b5e3b]"}`}><Money value={amount} /></p>
          <h3 id="payment-confirm-title" className="mb-1 text-lg font-black text-[#173a2b]">{title}</h3>
          <p className="mb-1 text-sm font-semibold text-gray-700">{memberName}</p>
          {detail && <p className="mb-1 text-xs text-gray-500">{detail}</p>}
          <p className="mx-auto mb-5 max-w-sm text-sm leading-5 text-[#718176]">{message}</p>
          {reject && (
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for rejection (required)"
              autoFocus
              rows={3}
              className="mb-4 w-full resize-none rounded-lg border border-red-200 bg-red-50/40 px-3.5 py-3 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-red-300 focus:ring-2 focus:ring-red-100"
            />
          )}
          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-md bg-[#eef1f3] py-2.5 font-bold text-[#536170] transition hover:bg-[#e3e7eb] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(reject ? reason.trim() : undefined)}
              disabled={busy || (reject && !reason.trim())}
              className={`flex-1 rounded-2xl py-3 font-bold text-white transition disabled:opacity-50 ${
                reject
                ? "bg-red-600 hover:bg-red-700"
                  : "bg-[#00a63c] hover:bg-[#008f34]"
              }`}
            >
              {busy ? "Processing..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
