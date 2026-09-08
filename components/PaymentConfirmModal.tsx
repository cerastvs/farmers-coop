"use client";

import { useState } from "react";
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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${
              reject ? "bg-red-50" : "bg-[#f0f7eb]"
            }`}
          >
            <Money
              value={amount}
              className={`text-sm font-bold ${
                reject ? "text-red-600" : "text-[#1b5e3b]"
              }`}
            />
          </div>
          <h3 className="mb-1 text-lg font-bold text-gray-900">{title}</h3>
          <p className="mb-1 text-sm font-semibold text-gray-700">{memberName}</p>
          {detail && <p className="mb-1 text-xs text-gray-500">{detail}</p>}
          <p className="mb-5 text-sm text-gray-500">{message}</p>
          {reject && (
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for rejection (required)"
              autoFocus
              rows={3}
              className="mb-4 w-full resize-none rounded-2xl border border-red-200 bg-red-50/30 px-3.5 py-2.5 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-red-300 focus:ring-2 focus:ring-red-100"
            />
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-2xl bg-gray-100 py-3 font-bold text-gray-600 transition hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(reject ? reason.trim() : undefined)}
              disabled={busy || (reject && !reason.trim())}
              className={`flex-1 rounded-2xl py-3 font-bold text-white transition disabled:opacity-50 ${
                reject
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
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