"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "../components/DashboardHeader";
import {
  BookedDate,
  BookingCalendar,
  formatShortDate,
  MyRequest,
  todayISO,
} from "../components/BookingCalendar";
import { IconChevronLeft } from "@/components/icons";
import { ImageModal } from "@/components/ImageModal";
import { Tractor, X } from "lucide-react";

interface OtherRequest {
  id: string;
  borrower: string;
  status: string;
  startDate: string;
  endDate: string;
}

interface Machine {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  myRequests: MyRequest[];
  otherRequests: OtherRequest[];
  bookedDates: BookedDate[];
}

export default function RentMachinePage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [borrowing, setBorrowing] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [formMachineId, setFormMachineId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [returning, setReturning] = useState<string | null>(null);
  const [returnConfirm, setReturnConfirm] = useState<string | null>(null);
  const [imageModal, setImageModal] = useState<{ src: string; alt: string } | null>(null);

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

  function openBorrowForm(machineId: string) {
    setFormMachineId(machineId);
    setStartDate("");
    setEndDate("");
    setMessage(null);
  }

  function closeBorrowForm() {
    setFormMachineId(null);
    setStartDate("");
    setEndDate("");
  }

  async function handleBorrow(machineId: string) {
    if (!startDate || !endDate) {
      setMessage({ type: "error", text: "Please select both start and end dates" });
      return;
    }

    if (endDate < startDate) {
      setMessage({ type: "error", text: "End date must be on or after start date" });
      return;
    }

    setBorrowing(machineId);
    setMessage(null);

    try {
      const res = await fetch("/api/machines/borrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineId, startDate, endDate }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        closeBorrowForm();
        fetchMachines();
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to submit request" });
    } finally {
      setBorrowing(null);
    }
  }

  async function handleCancel(requestId: string) {
    setCancelling(requestId);
    setMessage(null);

    try {
      const res = await fetch(`/api/machines/request/${requestId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        fetchMachines();
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to cancel request" });
    } finally {
      setCancelling(null);
    }
  }

  async function handleStart(requestId: string) {
    setStarting(requestId);
    setMessage(null);

    try {
      const res = await fetch(`/api/machines/request/${requestId}/start`, {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        setMachines((prev) =>
          prev.map((m) => ({
            ...m,
            myRequests: m.myRequests.map((r) =>
              r.id === requestId ? { ...r, status: "IN_USE" as const } : r,
            ),
          })),
        );
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to confirm pickup" });
    } finally {
      setStarting(null);
    }
  }

  async function handleReturn(requestId: string) {
    setReturning(requestId);
    setMessage(null);

    try {
      const res = await fetch(`/api/machines/request/${requestId}/return`, {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: data.message });

        setMachines((prev) =>
          prev.map((m) => ({
            ...m,
            myRequests: m.myRequests.map((r) =>
              r.id === requestId ? { ...r, status: "RETURN_PENDING" as const } : r,
            ),
          })),
        );
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to request return" });
    } finally {
      setReturning(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f7f2] flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#39733e]"></div>
      </div>
    );
  }

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
            Browse equipment and submit a borrow request
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
            Machines
          </h2>
          <div className="space-y-3">
            {machines.length > 0 ? (
              machines.map((machine) => {
                const isFormOpen = formMachineId === machine.id;
                const hasDateConflict = isFormOpen && startDate && endDate
                  ? machine.bookedDates.some((bd) => {
                      const bdStart = bd.startDate.split("T")[0];
                      const bdEnd = bd.endDate.split("T")[0];
                      return startDate <= bdEnd && endDate >= bdStart;
                    })
                  : false;

                return (
                  <div
                    key={machine.id}
                    className="rounded-2xl border border-[#e2e7dc] bg-white shadow-sm overflow-hidden"
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {machine.imageUrl ? (
                            <button
                              type="button"
                              onClick={() => setImageModal({ src: machine.imageUrl!, alt: machine.name })}
                              className="shrink-0"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={machine.imageUrl}
                                alt={machine.name}
                                className="h-16 w-16 rounded-xl object-cover border border-gray-200 hover:ring-2 hover:ring-blue-400 transition"
                              />
                            </button>
                          ) : (
                            <div className="h-16 w-16 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                              <Tractor size={24} className="text-blue-500" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base font-bold text-[#173a2b] truncate">
                              {machine.name}
                            </h3>
                            {machine.description && (
                              <p className="mt-1 text-sm text-[#718176] line-clamp-2">
                                {machine.description}
                              </p>
                            )}
                          </div>
                        </div>
                        {isFormOpen ? (
                          <button
                            onClick={closeBorrowForm}
                            className="shrink-0 rounded-xl px-3 py-2.5 text-sm font-bold bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                          >
                            <X size={16} />
                          </button>
                        ) : (
                          <button
                            onClick={() => openBorrowForm(machine.id)}
                            className="shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold bg-[#174b36] text-white hover:bg-[#1a5c42] transition-colors"
                          >
                            Borrow
                          </button>
                        )}
                      </div>
                    </div>

                    {isFormOpen && (
                      <div className="border-t border-[#e2e7dc] bg-[#f7f7f2] px-5 py-4 space-y-4">
                        <BookingCalendar
                          bookedDates={machine.bookedDates}
                          myRequests={machine.myRequests}
                          startDate={startDate}
                          endDate={endDate}
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-[#173a2b] mb-1">
                              Start Date
                            </label>
                            <input
                              type="date"
                              min={todayISO()}
                              value={startDate}
                              onChange={(e) => {
                                setStartDate(e.target.value);
                                if (endDate && e.target.value > endDate) {
                                  setEndDate("");
                                }
                              }}
                              className="w-full rounded-xl border border-[#d0dbd0] bg-white px-3 py-2.5 text-sm text-[#173a2b] focus:outline-none focus:ring-2 focus:ring-[#39733e] focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-[#173a2b] mb-1">
                              End Date
                            </label>
                            <input
                              type="date"
                              min={startDate || todayISO()}
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                              className="w-full rounded-xl border border-[#d0dbd0] bg-white px-3 py-2.5 text-sm text-[#173a2b] focus:outline-none focus:ring-2 focus:ring-[#39733e] focus:border-transparent"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2">
                          <button
                            onClick={closeBorrowForm}
                            className="rounded-xl px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-200 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleBorrow(machine.id)}
                            disabled={borrowing === machine.id || !startDate || !endDate || hasDateConflict}
                            className={`rounded-xl px-5 py-2 text-sm font-bold transition-colors ${
                              borrowing === machine.id || !startDate || !endDate
                                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                : hasDateConflict
                                  ? "bg-red-100 text-red-600 border border-red-300 cursor-not-allowed"
                                  : "bg-[#174b36] text-white hover:bg-[#1a5c42]"
                            }`}
                          >
                            {borrowing === machine.id
                              ? "Requesting..."
                              : hasDateConflict
                                ? "Dates conflict with existing booking"
                                : "Submit Request"}
                          </button>
                        </div>
                      </div>
                    )}

                    {(machine.myRequests ?? []).length > 0 && (
                      <div className="border-t border-[#e2e7dc] px-5 py-4 space-y-2">
                        <p className="text-xs font-semibold text-[#173a2b] mb-2">
                          My Requests
                        </p>
                        <div className="space-y-2">
                          {machine.myRequests.map((req) => (
                            <div
                              key={req.id}
                              className="flex items-center justify-between rounded-xl bg-white border border-[#eef2e8] px-4 py-3"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                      req.status === "QUEUED"
                                        ? "bg-yellow-100 text-yellow-700"
                                        : req.status === "APPROVED"
                                          ? "bg-blue-100 text-blue-700"
                                          : req.status === "IN_USE"
                                            ? "bg-green-100 text-green-700"
                                            : req.status === "RETURN_PENDING"
                                              ? "bg-amber-100 text-amber-700"
                                              : "bg-gray-100 text-gray-500"
                                    }`}
                                  >
                                    {req.status === "APPROVED"
                                      ? "Reserved"
                                      : req.status.charAt(0) + req.status.slice(1).toLowerCase()}
                                  </span>
                                  {req.startDate && req.endDate && (
                                    <span className="text-xs text-[#718176]">
                                      {formatShortDate(req.startDate)} – {formatShortDate(req.endDate)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {req.status === "QUEUED" && (
                                <button
                                  onClick={() => handleCancel(req.id)}
                                  disabled={cancelling === req.id}
                                  className="shrink-0 ml-3 rounded-lg px-3 py-1.5 text-xs font-bold text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                                >
                                  {cancelling === req.id ? "Cancelling..." : "Cancel"}
                                </button>
                              )}
                              {req.status === "APPROVED" && (
                                <button
                                  onClick={() => handleStart(req.id)}
                                  disabled={starting === req.id}
                                  className="shrink-0 ml-3 rounded-lg px-3 py-1.5 text-xs font-bold text-green-700 border border-green-200 hover:bg-green-50 transition-colors disabled:opacity-50"
                                >
                                  {starting === req.id ? "Starting..." : "Confirm pickup"}
                                </button>
                              )}
                              {req.status === "IN_USE" && (
                                <button
                                  onClick={() => setReturnConfirm(req.id)}
                                  disabled={returning === req.id}
                                  className="shrink-0 ml-3 rounded-lg px-3 py-1.5 text-xs font-bold text-amber-600 border border-amber-200 hover:bg-amber-50 transition-colors disabled:opacity-50"
                                >
                                  Return
                                </button>
                              )}
                              {req.status === "RETURN_PENDING" && (
                                <span className="shrink-0 ml-3 rounded-lg px-3 py-1.5 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200">
                                  Awaiting confirmation
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(machine.otherRequests ?? []).length > 0 && (
                      <div className="border-t border-[#e2e7dc] px-5 py-4 space-y-2">
                        <p className="text-xs font-semibold text-[#173a2b] mb-2">
                          Other Members&apos; Requests
                        </p>
                        <div className="space-y-2">
                          {machine.otherRequests.map((req) => (
                            <div
                              key={req.id}
                              className="flex items-center justify-between rounded-xl bg-white border border-[#eef2e8] px-4 py-3"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-[10px] font-bold text-blue-700">
                                  {req.borrower.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-[#173a2b] truncate">
                                    {req.borrower}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                        req.status === "QUEUED"
                                          ? "bg-orange-100 text-orange-700"
                                          : req.status === "APPROVED"
                                            ? "bg-red-100 text-red-700"
                                            : "bg-blue-100 text-blue-700"
                                      }`}
                                    >
                                      {req.status.charAt(0) + req.status.slice(1).toLowerCase()}
                                    </span>
                                    <span className="text-[11px] text-[#718176]">
                                      {formatShortDate(req.startDate)} – {formatShortDate(req.endDate)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-[#ccd9c8] bg-white p-5 text-center text-sm text-[#718176]">
                No machines available at the moment
              </div>
            )}
          </div>
        </section>

        <div className="h-4" />
      </main>

      {returnConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                <Tractor size={20} className="text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                Return Machine
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to return this machine early? The secretary will be notified to confirm.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setReturnConfirm(null)}
                  disabled={returning !== null}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-2xl font-bold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await handleReturn(returnConfirm);
                    setReturnConfirm(null);
                  }}
                  disabled={returning !== null}
                  className="flex-1 py-3 bg-amber-500 text-white hover:bg-amber-600 rounded-2xl font-bold transition disabled:opacity-50"
                >
                  {returning !== null ? "Returning..." : "Yes, Return"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {imageModal && (
        <ImageModal
          src={imageModal.src}
          alt={imageModal.alt}
          onClose={() => setImageModal(null)}
        />
      )}
    </div>
  );
}
