"use client";

import { useEffect, useState } from "react";

/**
 * Confirmation for restoring a disabled member's account.
 *
 * The mirror image of DeactivateMemberModal, and shared for the same reason:
 * reactivation immediately hands back access to loans, supplies, and machine
 * bookings, and it closes any pending request without anyone dismissing it. That
 * is worth one deliberate click rather than a single button press sitting next
 * to the destructive actions it is easy to fat-finger.
 */
export function ReactivateMemberModal({
  memberName,
  username,
  hasPendingRequest,
  onCancel,
  onConfirm,
}: {
  memberName: string;
  username: string;
  /** True when the member asked to come back, so officers know what they're answering. */
  hasPendingRequest?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-green-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-black text-[#173a2b]">
          Reactivate {memberName}&apos;s account?
        </h2>
        <p className="mt-1 text-sm text-[#718176]">
          @{username} will immediately regain access to loans, supplies, and
          machine bookings.
          {hasPendingRequest
            ? " This answers their pending reactivation request and closes it."
            : ""}
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 transition hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
          >
            {busy ? "Reactivating…" : "Reactivate account"}
          </button>
        </div>
      </div>
    </div>
  );
}
