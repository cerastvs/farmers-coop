"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle, CheckCircle2, XCircle } from "lucide-react";

interface PendingGuarantor {
  applicationId: string;
  member: { id: string; name: string; username: string };
  farm?: {
    fullName: string;
    farmSize: number;
    yearsFarming: number;
    farmOwnership: string;
    farmOwnershipDetails: string | null;
    address: string;
    crops: string[];
    machines: string[];
  } | null;
  guarantor: Record<string, unknown>;
  submittedAt: string;
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

function guarantorValue(guarantor: Record<string, unknown>, key: string) {
  return String(guarantor[key] ?? "").trim();
}

function guarantorFullName(guarantor: Record<string, unknown>) {
  const parts = [
    guarantorValue(guarantor, "firstName"),
    guarantorValue(guarantor, "middleName"),
    guarantorValue(guarantor, "lastName"),
    guarantorValue(guarantor, "extensionName"),
  ].filter(Boolean);
  return parts.join(" ") || "—";
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-[#5a7267]">{label}</span>
      <span className="text-right text-sm font-semibold text-[#0f2318]">
        {value}
      </span>
    </div>
  );
}

function ownershipLabel(
  ownership: string,
  details: string | null,
) {
  if (ownership === "FARM_OWNER") return "Farm owner";
  if (ownership === "FARM_WORKER") return "Farm worker";
  return details || ownership;
}

function ListValue({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-[#8fa594]">None</span>;
  return (
    <span className="inline-flex flex-wrap justify-end gap-1">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-md bg-[#eef3ea] px-2 py-0.5 text-xs font-medium text-[#1b5e3b]"
        >
          {item}
        </span>
      ))}
    </span>
  );
}

export function GuarantorApprovalsCard({
  onCountChange,
}: {
  onCountChange?: (count: number) => void;
}) {
  const [pending, setPending] = useState<PendingGuarantor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<PendingGuarantor | null>(null);
  const [rejecting, setRejecting] = useState<PendingGuarantor | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await requestJson("/api/admin/guarantors");
      setPending(data.pending ?? []);
      onCountChange?.(data.pending?.length ?? 0);
    } catch (error) {
      console.error("Failed to load guarantor approvals:", error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function removeFromList(applicationId: string) {
    setPending((prev) =>
      prev.filter((item) => item.applicationId !== applicationId),
    );
    onCountChange?.(Math.max(pending.length - 1, 0));
  }

  async function approve(target: PendingGuarantor) {
    setBusy(target.applicationId);
    try {
      await requestJson(`/api/admin/guarantors/${target.applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      removeFromList(target.applicationId);
      setConfirming(null);
    } catch (error) {
      console.error("Failed to approve guarantor:", error);
    } finally {
      setBusy(null);
    }
  }

  async function reject(target: PendingGuarantor, reason: string) {
    setBusy(target.applicationId);
    try {
      await requestJson(`/api/admin/guarantors/${target.applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason }),
      });
      removeFromList(target.applicationId);
      setRejecting(null);
    } catch (error) {
      console.error("Failed to reject guarantor:", error);
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-[#e2ebe6] bg-white shadow-sm">
        <div className="border-b border-[#f0f3ed] px-5 py-4">
          <h2
            className="text-sm font-bold text-[#0f2318]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Guarantor approvals needed
          </h2>
        </div>
        <p className="px-5 py-8 text-center text-sm text-[#5a7267]">
          Loading guarantor approvals…
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-xl border border-[#e2ebe6] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#f0f3ed] px-5 py-4">
          <div>
            <h2
              className="text-sm font-bold text-[#0f2318]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Guarantor approvals needed
            </h2>
            <p className="text-xs text-[#5a7267]">{pending.length} pending</p>
          </div>
        </div>

        {pending.length > 0 ? (
          <div className="divide-y divide-[#f0f3ed]">
            {pending.slice(0, 4).map((item) => (
              <div
                key={item.applicationId}
                className="px-5 py-3 transition-colors hover:bg-[#fafcfb]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#0f2318]">
                      {item.member.name}
                    </p>
                    <p className="text-xs text-[#5a7267]">
                      {guarantorValue(item.guarantor, "firstName")}{" "}
                      {guarantorValue(item.guarantor, "lastName")} ·{" "}
                      {guarantorValue(item.guarantor, "relationship") || "—"} ·{" "}
                      {guarantorValue(item.guarantor, "contact") || "no contact"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      disabled={busy === item.applicationId}
                      onClick={() => setConfirming(item)}
                      className={buttonPrimary}
                    >
                      <CheckCircle2 size={13} />
                      Approve
                    </button>
                    <button
                      disabled={busy === item.applicationId}
                      onClick={() => {
                        setRejectReason("");
                        setRejecting(item);
                      }}
                      className={buttonDanger}
                    >
                      <XCircle size={13} />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-8 text-center">
            <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
            <p className="text-sm text-[#5a7267]">
              No pending guarantor approvals. Members&apos; guarantors are fully
              verified.
            </p>
          </div>
        )}
      </section>

      {confirming && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f5ec]">
                <CheckCircle size={20} className="text-[#1b5e3b]" />
              </div>
              <h3 className="mb-1 text-lg font-bold text-gray-900">
                Approve this guarantor?
              </h3>
              <p className="mb-5 text-sm text-gray-500">
                <span className="font-semibold text-gray-700">
                  {confirming.member.name}
                </span>{" "}
                (@{confirming.member.username})&apos;s guarantor will be marked
                as verified. The member can then apply for loans.
              </p>
            </div>

            <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
              <div className="space-y-2.5 rounded-2xl border border-[#e2ebe6] bg-[#fafcfb] p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#1b5e3b]">
                  Guarantor
                </p>
                <DetailRow
                  label="Full name"
                  value={guarantorFullName(confirming.guarantor)}
                />
                <DetailRow
                  label="Contact number"
                  value={
                    guarantorValue(confirming.guarantor, "contact") || "—"
                  }
                />
                <DetailRow
                  label="Relationship"
                  value={
                    guarantorValue(confirming.guarantor, "relationship") || "—"
                  }
                />
              </div>

              {confirming.farm && (
                <>
                  <div className="space-y-2.5 rounded-2xl border border-[#e2ebe6] bg-[#fafcfb] p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#1b5e3b]">
                      Farm Details
                    </p>
                    <DetailRow label="Full name" value={confirming.farm.fullName} />
                    <DetailRow label="Address" value={confirming.farm.address} />
                    <DetailRow
                      label="Farm size"
                      value={`${confirming.farm.farmSize} ha`}
                    />
                    <DetailRow
                      label="Years farming"
                      value={`${confirming.farm.yearsFarming} yrs`}
                    />
                    <DetailRow
                      label="Farm ownership"
                      value={ownershipLabel(
                        confirming.farm.farmOwnership,
                        confirming.farm.farmOwnershipDetails,
                      )}
                    />
                  </div>

                  <div className="space-y-2.5 rounded-2xl border border-[#e2ebe6] bg-[#fafcfb] p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#1b5e3b]">
                      Owned Machines
                    </p>
                    <DetailRow
                      label="Machines"
                      value={
                        <ListValue items={confirming.farm.machines} />
                      }
                    />
                  </div>
                </>
              )}
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirming(null)}
                disabled={busy === confirming.applicationId}
                className="flex-1 rounded-2xl bg-gray-100 py-3 font-bold text-gray-600 transition hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => approve(confirming)}
                disabled={busy === confirming.applicationId}
                className="flex-1 rounded-2xl bg-[#1b5e3b] py-3 font-bold text-white transition hover:bg-[#154a2f] disabled:opacity-50"
              >
                {busy === confirming.applicationId ? "Approving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <XCircle size={20} className="text-red-600" />
              </div>
              <h3 className="mb-1 text-lg font-bold text-gray-900">
                Reject this guarantor?
              </h3>
              <p className="mb-5 text-sm text-gray-500">
                <span className="font-semibold text-gray-700">
                  {rejecting.member.name}
                </span>{" "}
                (@{rejecting.member.username}) will be notified. They can update
                their guarantor and submit it for review again.
              </p>
            </div>

            <div className="mb-5 space-y-2.5 rounded-2xl border border-[#e2ebe6] bg-[#fafcfb] p-4">
              <DetailRow
                label="Guarantor"
                value={guarantorFullName(rejecting.guarantor)}
              />
              <DetailRow
                label="Contact number"
                value={
                  guarantorValue(rejecting.guarantor, "contact") || "—"
                }
              />
              <DetailRow
                label="Relationship"
                value={
                  guarantorValue(rejecting.guarantor, "relationship") || "—"
                }
              />
            </div>

            <label className="mb-1.5 block text-xs font-semibold text-[#3d5c47]">
              Reason for rejection (required)
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="State why this guarantor could not be approved"
              rows={3}
              autoFocus
              className="mb-5 w-full resize-none rounded-2xl border border-red-200 bg-red-50/30 px-3.5 py-2.5 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-red-300 focus:ring-2 focus:ring-red-100"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setRejecting(null)}
                disabled={busy === rejecting.applicationId}
                className="flex-1 rounded-2xl bg-gray-100 py-3 font-bold text-gray-600 transition hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => reject(rejecting, rejectReason.trim())}
                disabled={busy === rejecting.applicationId || !rejectReason.trim()}
                className="flex-1 rounded-2xl bg-red-600 py-3 font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {busy === rejecting.applicationId ? "Rejecting…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}