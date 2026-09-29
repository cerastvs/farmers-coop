"use client";

import { useState } from "react";

/**
 * Sends the reactivation request for a disabled account.
 *
 * The button disables itself once a request exists, because the server treats
 * a repeat request as a no-op — but hiding the control entirely would leave
 * the member unsure whether it ever went through, so the "already sent" state
 * stays visible with the timestamp.
 */
export function ReactivationRequestButton({
  alreadyRequested,
  requestedAt,
}: {
  alreadyRequested: boolean;
  requestedAt: string | null;
}) {
  const [sent, setSent] = useState(alreadyRequested);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(
    alreadyRequested && requestedAt
      ? `Request sent on ${requestedAt}. The President and Secretary have been notified.`
      : null,
  );
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/reactivation-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to send request");
      setSent(true);
      setMessage(data.message ?? "Your request has been sent.");
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send request");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-[#cfe3b8] bg-[#f1f8e8] p-4">
        <p className="text-sm font-bold text-[#2d6a2d]">Request sent</p>
        <p className="mt-1 text-sm text-[#4a6142]">{message}</p>
        <p className="mt-2 text-xs text-[#6b7d63]">
          An officer will review your account. You will be notified when it is
          restored.
        </p>
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor="reactivation-note"
        className="block text-xs font-bold uppercase tracking-wide text-[#718176]"
      >
        Add a note for the officers (optional)
      </label>
      <textarea
        id="reactivation-note"
        value={note}
        maxLength={500}
        rows={3}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anything that would help them review your account…"
        className="mt-2 w-full rounded-xl border border-[#dce5d9] bg-white p-3 text-sm text-[#173a2b] outline-none focus:border-[#26633f]"
      />

      {error && (
        <p className="mt-2 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="mt-3 w-full rounded-xl bg-[#26633f] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1d4d30] disabled:opacity-60"
      >
        {busy ? "Sending request…" : "Request reactivation"}
      </button>
      <p className="mt-2 text-xs text-[#8a968d]">
        This notifies the President and Secretary in their member management
        workspace.
      </p>
    </div>
  );
}
