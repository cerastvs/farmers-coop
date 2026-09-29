"use client";

import { useEffect, useState } from "react";

/**
 * Confirmation for disabling a member's account, with an optional reason.
 *
 * Shared by both officer workspaces — the officer dashboard and the standalone
 * admin workspace — so a member sees the same wording and the same reason
 * limit wherever their account was disabled from. Disabling cuts a member off
 * from loans, supplies, and machine bookings immediately, so it should never
 * be a silent toggle.
 */
export function DeactivateMemberModal({
  memberName,
  username,
  onCancel,
  onConfirm,
}: {
  memberName: string;
  username: string;
  onCancel: () => void;
  onConfirm: (reason?: string) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  async function confirm() {
    const trimmed = reason.trim();
    setBusy(true);
    try {
      await onConfirm(trimmed || undefined);
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
        className="w-full max-w-sm rounded-2xl border border-red-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-black text-[#173a2b]">
          Disable {memberName}&apos;s account?
        </h2>
        <p className="mt-1 text-sm text-[#718176]">
          @{username} will immediately lose access to loans, supplies, and
          machine bookings. They will see a notice page explaining why, and can
          request reactivation from it.
        </p>

        <label
          htmlFor="deactivation-reason"
          className="mt-4 block text-xs font-bold uppercase tracking-wide text-[#718176]"
        >
          Reason <span className="font-normal normal-case">(optional)</span>
        </label>
        <textarea
          id="deactivation-reason"
          autoFocus
          value={reason}
          maxLength={500}
          rows={3}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Shown to the member on their notice page…"
          className="mt-2 w-full resize-none rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-[#173a2b] outline-none placeholder:text-[#b08a8a] focus:border-red-400"
        />

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
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "Disabling…" : "Disable account"}
          </button>
        </div>
      </div>
    </div>
  );
}
