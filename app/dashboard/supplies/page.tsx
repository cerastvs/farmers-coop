"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "../components/DashboardHeader";
import { MemberPageHeader } from "../components/MemberPageHeader";
import memberStyles from "../components/member.module.css";
import { Money } from "@/components/Money";
import { useMarkAlertSeen } from "../hooks/useAlertSeen";
import { fetchWithTimeout } from "../hooks/fetchWithTimeout";
import { supplyStatusClass, supplyStatusLabel } from "./status";

interface Supply {
  id: string;
  productName: string;
  price: number;
  quantity: number;
  loanLimitPerHectare: number | null;
  imageUrl?: string | null;
}

interface SupplyRequest {
  id: string;
  quantity: number;
  totalPrice: number;
  type: "PURCHASE" | "LOAN";
  status: string;
  rejectionReason?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  remarks?: string | null;
  supply: Supply;
}

export default function SuppliesPage() {
  useMarkAlertSeen("supplyAlerts");
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [hasGuarantor, setHasGuarantor] = useState<boolean | null>(null);
  const [guarantorStatus, setGuarantorStatus] = useState<string | null>(null);
  const [hasHectares, setHasHectares] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [farmSize, setFarmSize] = useState<number | null>(null);
  const [farmOwnership, setFarmOwnership] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const loadSupplies = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await fetchWithTimeout("/api/supplies");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load supplies");
      setSupplies(data.supplies);
      setRequests(data.requests);
      setFarmSize(typeof data.farmSize === "number" ? data.farmSize : null);
      setFarmOwnership(typeof data.farmOwnership === "string" ? data.farmOwnership : null);
      setHasGuarantor(data.hasGuarantor);
      if (typeof data.hasHectares === "boolean") setHasHectares(data.hasHectares);
      setGuarantorStatus(
        typeof data.guarantorStatus === "string" ? data.guarantorStatus : null,
      );
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load supplies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSupplies();
  }, [loadSupplies]);

  async function requestSupply(event: FormEvent<HTMLFormElement>, supplyId: string) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmittingId(supplyId);
    setMessage(null);
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/supplies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplyId,
          quantity: Number(form.get("quantity")),
          type: form.get("type"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? data.message ?? "Unable to submit request");
      setMessage({ kind: "success", text: data.message ?? "Supply request submitted." });
      formElement.reset();
      await loadSupplies();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Unable to submit request" });
    } finally {
      setSubmittingId(null);
    }
  }

  async function cancelRequest(requestId: string) {
    setCancellingId(requestId);
    setMessage(null);
    try {
      const response = await fetch(`/api/supplies/${requestId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? data.message ?? "Unable to cancel request");
      setMessage({ kind: "success", text: data.message ?? "Request cancelled." });
      await loadSupplies();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Unable to cancel request" });
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className={memberStyles.surface}>
      <DashboardHeader />
      <main className="mx-auto w-full max-w-5xl space-y-7 px-4 py-6">
        <MemberPageHeader title="Farm supplies" description="Request supplies for purchase or as a cooperative loan." indicator={guarantorStatus === "REJECTED" ? <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-red-200" /> : undefined} />
        {loadError && <div role="alert" className={memberStyles.error}>{loadError}<button onClick={() => void loadSupplies()}>Try again</button></div>}
        {(farmSize !== null || farmOwnership) && <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-[#ccd4c8] pb-4 text-sm text-[#536b5f]"><span>Farm size on file: <strong className="text-[#173b31]">{farmSize !== null ? `${farmSize} ha` : "Not set"}</strong></span><span>Farm role: <strong className="text-[#173b31]">{farmOwnership ? farmOwnership.replaceAll("_", " ").toLowerCase() : "Not set"}</strong></span><Link href="/registration" className="font-bold text-[#416747] underline underline-offset-4">Update profile</Link></div>}

        {hasGuarantor === false && guarantorStatus === "REJECTED" && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-bold">Guarantor Rejected</p>
            <p className="mt-1 text-xs leading-relaxed text-red-700">
              Your guarantor was not approved. Update your guarantor through{" "}
              <span className="font-semibold">Edit Profile</span> and wait for
              the president or treasurer to review it. Purchases are still
              available.
            </p>
          </div>
        )}

        {hasGuarantor === false && guarantorStatus === "PENDING" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-bold">Guarantor Approval Pending</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-700">
              Your guarantor is on file but has{" "}
              <span className="font-semibold">not yet been verified</span>.
              Loan option is temporarily disabled until the president or
              treasurer approves it. Purchases are still available.
            </p>
          </div>
        )}

        {hasGuarantor === false &&
          guarantorStatus !== "PENDING" &&
          guarantorStatus !== "REJECTED" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-bold">Guarantor Required</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-700">
              You need a guarantor on file before requesting a supply loan. Purchases are still
              available. Add your guarantor through{" "}
              <span className="font-semibold">Edit Profile</span> in your dashboard.
            </p>
          </div>
        )}

        {message && (
          <p aria-live="polite" className={`rounded-xl px-4 py-3 text-sm ${message.kind === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {message.text}
          </p>
        )}

        <section>
          <h2 className="mb-3 font-bold text-gray-800">Available Inventory</h2>
          {!hasHectares && (
            <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
              Some supplies are limited per hectare, and there is no farm size
              on file for you, so those are not listed. Everything shown here is
              available to you as it is.
            </p>
          )}
          {loading ? (
            <p className="rounded-2xl bg-white p-8 text-center text-sm text-gray-500">Loading supplies…</p>
          ) : supplies.length === 0 && !loadError ? (
            <p className="rounded-2xl bg-white p-8 text-center text-sm text-gray-500">No supplies are currently available.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {supplies.map((supply) => (
                <article key={supply.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-gray-900">{supply.productName}</h3>
                      {/* Stock is reserved the moment a request is approved, so
                          this figure is what is still available to order, not a
                          physical count of goods in the warehouse. */}
                      <p className="text-sm text-gray-500">{supply.quantity} available</p>
                      {supply.loanLimitPerHectare != null && (
                        <p className="text-xs text-orange-600 font-medium">Loan limit: {supply.loanLimitPerHectare} per hectare</p>
                      )}
                      {supply.imageUrl && <a href={supply.imageUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-bold text-[#416747] underline underline-offset-2">View supply image</a>}
                    </div>
                    <p className="font-bold text-green-700"><Money value={supply.price} /></p>
                  </div>
                  <form onSubmit={(event) => requestSupply(event, supply.id)} className="mt-4 grid grid-cols-[1fr_1fr_auto] gap-2">
                    <input aria-label="Quantity" name="quantity" type="number" min="1" max={supply.quantity} defaultValue="1" required className="min-w-0 rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                    <select aria-label="Request type" name="type" className="min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" defaultValue="PURCHASE">
                      <option value="PURCHASE">Purchase</option>
                      <option value="LOAN" disabled={hasGuarantor === false}>Loan</option>
                    </select>
                    <button disabled={!supply.quantity || submittingId === supply.id} className="rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                      {submittingId === supply.id ? "…" : "Request"}
                    </button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-bold text-gray-800">My Requests</h2>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {requests.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-500">No supply requests yet.</p>
            ) : requests.map((request) => (
              <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4 last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{request.supply.productName} × {request.quantity}</p>
                    <p className="text-xs text-gray-500">{request.type} · <Money value={request.totalPrice} /> · {new Date(request.createdAt).toLocaleDateString()}</p>
                    {request.rejectionReason && <p className="mt-1 text-xs text-red-600">{request.rejectionReason}</p>}
                    {request.reviewedAt && <p className="mt-1 text-xs text-gray-500">Reviewed {new Date(request.reviewedAt).toLocaleDateString("en-PH")}</p>}
                    {request.remarks && <p className="mt-1 text-xs text-gray-600">Note: {request.remarks}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {request.status === "PENDING" && (
                      <button
                        onClick={() => cancelRequest(request.id)}
                        disabled={cancellingId === request.id}
                        className="rounded-full border border-gray-200 px-2.5 py-1 text-xs font-bold text-gray-500 hover:border-red-200 hover:text-red-600 disabled:opacity-50"
                      >
                        {cancellingId === request.id ? "Cancelling…" : "Cancel"}
                      </button>
                    )}
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${supplyStatusClass(request.status)}`}>{supplyStatusLabel(request.status)}</span>
                  </div>
                </div>
                {request.status === "APPROVED" && (
                  <p className="mt-1 w-full text-xs font-semibold text-green-700">
                    {request.type === "LOAN"
                      ? "Ready for pickup — collect your loan supplies at the cooperative office."
                      : "Ready for pickup — collect your purchase at the cooperative office."}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
