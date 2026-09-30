"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

interface PendingFarmSize {
  applicationId: string;
  member: { id: string; name: string; username: string; role?: string };
  fullName: string;
  requestedFarmSize: number;
  currentFarmSize: number | null;
  farmOwnership: string;
  farmOwnershipDetails: string | null;
  /** How many machine-days this change adds or removes this season. */
  machineDayChange: number | null;
}

const buttonPrimary =
  "inline-flex items-center gap-1.5 rounded-lg bg-[#1b5e3b] px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-[#15503a] hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
const buttonDanger =
  "inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 transition-all hover:bg-red-50 hover:border-red-300 active:scale-[0.98] disabled:opacity-40";

async function requestJson(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error ?? data.message ?? "Request failed");
  return data;
}

function ha(value: number | null | undefined) {
  return value == null ? "not set" : `${value} ha`;
}

function ownershipLabel(ownership: string, details: string | null) {
  if (ownership === "FARM_OWNER") return "Farm owner";
  if (ownership === "FARM_WORKER") return "Farm worker";
  return details || ownership;
}

function machineDaySummary(change: number | null) {
  if (change === null) return "New farm size — machine-day budget starts from zero";
  if (change === 0) return "No change in machine-days";
  return change > 0
    ? `Adds ${change} machine-day${change === 1 ? "" : "s"} this season`
    : `Removes ${Math.abs(change)} machine-day${change === -1 ? "" : "s"} this season`;
}

export function FarmSizeApprovalsCard({
  onCountChange,
}: {
  onCountChange?: (count: number) => void;
}) {
  const [pending, setPending] = useState<PendingFarmSize[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<PendingFarmSize | null>(null);
  const [rejecting, setRejecting] = useState<PendingFarmSize | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await requestJson("/api/admin/farm-sizes");
      setPending(data.pending ?? []);
      onCountChange?.(data.pending?.length ?? 0);
    } catch (error) {
      console.error("Failed to load farm size approvals:", error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function removeFromList(applicationId: string) {
    setPending((prev) => prev.filter((item) => item.applicationId !== applicationId));
    onCountChange?.(Math.max(pending.length - 1, 0));
  }

  async function approve(target: PendingFarmSize) {
    setBusy(target.applicationId);
    try {
      await requestJson(`/api/admin/farm-sizes/${target.applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      removeFromList(target.applicationId);
      setConfirming(null);
    } catch (error) {
      console.error("Failed to approve farm size:", error);
    } finally {
      setBusy(null);
    }
  }

  async function reject(target: PendingFarmSize, reason?: string) {
    setBusy(target.applicationId);
    try {
      await requestJson(`/api/admin/farm-sizes/${target.applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason }),
      });
      removeFromList(target.applicationId);
      setRejecting(null);
      setRejectReason("");
    } catch (error) {
      console.error("Failed to reject farm size:", error);
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-[#e2ebe6] bg-white shadow-sm">
        <div className="border-b border-[#f0f3ed] px-5 py-4">
          <h2 className="text-sm font-bold text-[#0f2318]">Farm size reviews</h2>
        </div>
        <p className="px-5 py-8 text-center text-sm text-[#5a7267]">
          Loading farm size reviews…
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-xl border border-[#e2ebe6] bg-white shadow-sm">
        <div className="border-b border-[#f0f3ed] px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#0f2318]">
            Farm size reviews
            {pending.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                {pending.length}
              </span>
            )}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[#5a7267]">
            One hectare is one machine-day, so approving a farm size hands out
            machine capacity and can raise a per-hectare supply loan limit. The
            member keeps their current allowance until you decide.
          </p>
        </div>

        {pending.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-[#5a7267]">
            No farm size changes are waiting for review.
          </p>
        ) : (
          <ul className="divide-y divide-[#f0f3ed]">
            {pending.map((item) => (
              <li key={item.applicationId} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#0f2318]">
                      {item.fullName || item.member.name}
                    </p>
                    <p className="text-xs text-[#5a7267]">
                      {ownershipLabel(item.farmOwnership, item.farmOwnershipDetails)}
                    </p>
                    <p className="mt-1.5 text-sm">
                      <span className="text-[#5a7267]">On file: </span>
                      <span className="font-semibold text-[#0f2318]">
                        {ha(item.currentFarmSize)}
                      </span>
                      <span className="mx-2 text-[#8fa594]">→</span>
                      <span className="text-[#5a7267]">Requested: </span>
                      <span className="font-bold text-[#1b5e3b]">
                        {ha(item.requestedFarmSize)}
                      </span>
                    </p>
                    <p className="mt-1 text-xs font-semibold text-amber-700">
                      {machineDaySummary(item.machineDayChange)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={buttonPrimary}
                      disabled={busy === item.applicationId}
                      onClick={() => setConfirming(item)}
                    >
                      <CheckCircle2 size={14} />
                      Approve
                    </button>
                    <button
                      type="button"
                      className={buttonDanger}
                      disabled={busy === item.applicationId}
                      onClick={() => setRejecting(item)}
                    >
                      <XCircle size={14} />
                      Reject
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-[#0f2318]">
              Approve this farm size?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#5a7267]">
              {confirming.fullName || confirming.member.name} goes from{" "}
              {ha(confirming.currentFarmSize)} to {ha(confirming.requestedFarmSize)}.
              This takes effect immediately:{" "}
              {machineDaySummary(confirming.machineDayChange).toLowerCase()}.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3.5 py-2 text-xs font-semibold text-[#5a7267] hover:bg-[#f3f7f2]"
                onClick={() => setConfirming(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={buttonPrimary}
                disabled={busy === confirming.applicationId}
                onClick={() => approve(confirming)}
              >
                Confirm approval
              </button>
            </div>
          </div>
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-[#0f2318]">
              Reject this farm size?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#5a7267]">
              The request for {ha(rejecting.requestedFarmSize)} is discarded and{" "}
              {rejecting.fullName || rejecting.member.name} keeps{" "}
              {ha(rejecting.currentFarmSize)}. They can submit a new request.
            </p>
            <label className="mt-4 block text-xs font-semibold text-[#0f2318]">
              Reason (optional)
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              maxLength={500}
              rows={3}
              className="mt-1.5 w-full rounded-lg border border-[#dbe5d7] px-3 py-2 text-sm outline-none focus:border-[#4f7e38]"
              placeholder="e.g. Does not match the proof of farm provided"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3.5 py-2 text-xs font-semibold text-[#5a7267] hover:bg-[#f3f7f2]"
                onClick={() => {
                  setRejecting(null);
                  setRejectReason("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={buttonDanger}
                disabled={busy === rejecting.applicationId}
                onClick={() => reject(rejecting, rejectReason)}
              >
                Reject request
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
