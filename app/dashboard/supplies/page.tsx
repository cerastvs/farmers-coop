"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "../components/DashboardHeader";
import { IconChevronLeft } from "@/components/icons";
import { Money } from "@/components/Money";

interface Supply {
  id: string;
  productName: string;
  price: number;
  quantity: number;
  loanLimitPerHectare: number | null;
}

interface SupplyRequest {
  id: string;
  quantity: number;
  totalPrice: number;
  type: "PURCHASE" | "LOAN";
  status: string;
  rejectionReason?: string | null;
  createdAt: string;
  supply: Supply;
}

export default function SuppliesPage() {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [pickingUpId, setPickingUpId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const loadSupplies = useCallback(async () => {
    try {
      const response = await fetch("/api/supplies");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load supplies");
      setSupplies(data.supplies);
      setRequests(data.requests);
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Unable to load supplies" });
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

  async function pickupRequest(requestId: string) {
    setPickingUpId(requestId);
    setMessage(null);
    try {
      const response = await fetch(`/api/supplies/${requestId}`, { method: "PATCH" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? data.message ?? "Unable to mark as picked up");
      setMessage({ kind: "success", text: data.message ?? "Request marked as picked up." });
      await loadSupplies();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Unable to mark as picked up" });
    } finally {
      setPickingUpId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <main className="mx-auto w-full max-w-5xl space-y-7 px-4 py-6">
        <div>
          <Link href="/dashboard" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-green-800 hover:underline">
            <IconChevronLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Farm Supplies</h1>
          <p className="mt-1 text-sm text-gray-500">Request supplies for purchase or as a cooperative loan.</p>
        </div>

        {message && (
          <p aria-live="polite" className={`rounded-xl px-4 py-3 text-sm ${message.kind === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {message.text}
          </p>
        )}

        <section>
          <h2 className="mb-3 font-bold text-gray-800">Available Inventory</h2>
          {loading ? (
            <p className="rounded-2xl bg-white p-8 text-center text-sm text-gray-500">Loading supplies…</p>
          ) : supplies.length === 0 ? (
            <p className="rounded-2xl bg-white p-8 text-center text-sm text-gray-500">No supplies are currently available.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {supplies.map((supply) => (
                <article key={supply.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-gray-900">{supply.productName}</h3>
                      <p className="text-sm text-gray-500">{supply.quantity} in stock</p>
                      {supply.loanLimitPerHectare != null && (
                        <p className="text-xs text-orange-600 font-medium">Loan limit: {supply.loanLimitPerHectare} per hectare</p>
                      )}
                    </div>
                    <p className="font-bold text-green-700"><Money value={supply.price} /></p>
                  </div>
                  <form onSubmit={(event) => requestSupply(event, supply.id)} className="mt-4 grid grid-cols-[1fr_1fr_auto] gap-2">
                    <input aria-label="Quantity" name="quantity" type="number" min="1" max={supply.quantity} defaultValue="1" required className="min-w-0 rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                    <select aria-label="Request type" name="type" className="min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                      <option value="PURCHASE">Purchase</option>
                      <option value="LOAN">Loan</option>
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
                    {request.status === "APPROVED" && (
                      <button
                        onClick={() => pickupRequest(request.id)}
                        disabled={pickingUpId === request.id}
                        className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700 hover:bg-green-100 disabled:opacity-50"
                      >
                        {pickingUpId === request.id ? "Picking up…" : "Picked Up"}
                      </button>
                    )}
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">{request.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
