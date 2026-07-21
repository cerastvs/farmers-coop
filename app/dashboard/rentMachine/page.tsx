"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "../components/DashboardHeader";
import { IconChevronLeft } from "@/components/icons";

interface Machine {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  activeRequests: number;
  available: number;
  userHasActiveRequest: boolean;
}

export default function RentMachinePage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [borrowing, setBorrowing] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetchMachines();
  }, []);

  async function fetchMachines() {
    try {
      const res = await fetch("/api/machines");
      if (res.ok) {
        const data = await res.json();
        setMachines(data.machines);
      }
    } catch (error) {
      console.error("Failed to fetch machines:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleBorrow(machineId: string) {
    setBorrowing(machineId);
    setMessage(null);

    try {
      const res = await fetch("/api/machines/borrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineId }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        fetchMachines();
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch (error) {
      console.error("Borrow request failed:", error);
      setMessage({ type: "error", text: "Failed to submit request" });
    } finally {
      setBorrowing(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f7f2] flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#39733e]"></div>
      </div>
    );
  }

  const availableMachines = machines.filter((m) => m.available > 0);
  const unavailableMachines = machines.filter((m) => m.available === 0);

  return (
    <div className="min-h-screen bg-[#f7f7f2] flex flex-col">
      <DashboardHeader />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-6">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-[#2d6a2d] font-medium mb-3 hover:underline"
          >
            <IconChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Rent Machine</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Browse available equipment and submit a borrow request
          </p>
        </div>

        {message && (
          <div
            className={`rounded-xl px-4 py-3 text-sm font-medium ${
              message.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        <section>
          <h2 className="mb-3 text-base font-extrabold text-[#173a2b]">
            Available Machines
          </h2>
          <div className="space-y-3">
            {availableMachines.length > 0 ? (
              availableMachines.map((machine) => (
                <div
                  key={machine.id}
                  className="rounded-2xl border border-[#e2e7dc] bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[#173a2b] truncate">
                          {machine.name}
                        </h3>
                        <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                          {machine.available} available
                        </span>
                      </div>
                      {machine.description && (
                        <p className="mt-1 text-sm text-[#718176] line-clamp-2">
                          {machine.description}
                        </p>
                      )}
                      <p className="mt-1.5 text-xs text-[#718176]">
                        {machine.quantity - machine.available} of{" "}
                        {machine.quantity} units currently borrowed
                      </p>
                    </div>
                    <button
                      onClick={() => handleBorrow(machine.id)}
                      disabled={
                        borrowing === machine.id ||
                        machine.userHasActiveRequest
                      }
                      className={`shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold transition-colors ${
                        machine.userHasActiveRequest
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : borrowing === machine.id
                            ? "bg-gray-200 text-gray-500 cursor-wait"
                            : "bg-[#174b36] text-white hover:bg-[#1a5c42]"
                      }`}
                    >
                      {machine.userHasActiveRequest
                        ? "Already Borrowed"
                        : borrowing === machine.id
                          ? "Requesting..."
                          : "Borrow"}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[#ccd9c8] bg-white p-5 text-center text-sm text-[#718176]">
                No machines available at the moment
              </div>
            )}
          </div>
        </section>

        {unavailableMachines.length > 0 && (
          <section>
            <h2 className="mb-3 text-base font-extrabold text-[#173a2b]">
              Currently Unavailable
            </h2>
            <div className="space-y-3">
              {unavailableMachines.map((machine) => (
                <div
                  key={machine.id}
                  className="rounded-2xl border border-[#e2e7dc] bg-white p-5 shadow-sm opacity-70"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[#173a2b] truncate">
                          {machine.name}
                        </h3>
                        <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                          All units borrowed
                        </span>
                      </div>
                      {machine.description && (
                        <p className="mt-1 text-sm text-[#718176] line-clamp-2">
                          {machine.description}
                        </p>
                      )}
                    </div>
                    <button
                      disabled
                      className="shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold bg-gray-100 text-gray-400 cursor-not-allowed"
                    >
                      Unavailable
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="h-4" />
      </main>
    </div>
  );
}
