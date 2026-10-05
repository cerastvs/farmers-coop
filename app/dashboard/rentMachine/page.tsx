"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "../components/DashboardHeader";
import { MemberPageHeader } from "../components/MemberPageHeader";
import memberStyles from "../components/member.module.css";
import {
  BookedDate,
  BookingCalendar,
  formatShortDate,
  MyRequest,
  todayISO,
} from "../components/BookingCalendar";
import { ImageModal } from "@/components/ImageModal";
import { Tractor, X, CalendarDays, FileCheck } from "lucide-react";
import { useMarkAlertSeen } from "../hooks/useAlertSeen";
import { fetchWithTimeout } from "../hooks/fetchWithTimeout";

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

interface SeasonCapacity {
  seasonId: string;
  seasonName: string;
  bookedHectareDays: number;
}

export default function RentMachinePage() {
  useMarkAlertSeen("machineAlerts");
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  const [farmSize, setFarmSize] = useState<number>(1);
  const [allowedDurationDays, setAllowedDurationDays] = useState<number>(1);
  const [seasonCapacity, setSeasonCapacity] = useState<SeasonCapacity | null>(null);
  const [canBorrow, setCanBorrow] = useState(true);

  useEffect(() => {
    fetchMachines();
  }, []);

  async function fetchMachines() {
    setLoadError(null);
    try {
      const res = await fetchWithTimeout("/api/machines");
      if (!res.ok) throw new Error("Machinery details are unavailable right now.");
      const data = await res.json();
      setMachines(data.machines);
      if (typeof data.farmSize === "number") setFarmSize(data.farmSize);
      if (typeof data.allowedDurationDays === "number")
        setAllowedDurationDays(data.allowedDurationDays);
      setSeasonCapacity(data.seasonCapacity ?? null);
      if (typeof data.canBorrow === "boolean") setCanBorrow(data.canBorrow);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Machinery details are unavailable right now.");
    } finally {
      setLoading(false);
    }
  }

  function selectedDurationDays() {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  const exceedsAllowedDuration =
    selectedDurationDays() !== null && selectedDurationDays()! > allowedDurationDays;

  const bookedInSeason = seasonCapacity?.bookedHectareDays ?? 0;
  const seasonLimit = allowedDurationDays;
  const remainingInSeason = Math.max(0, seasonLimit - bookedInSeason);
  const prospectiveDays = (selectedDurationDays() ?? 0) + bookedInSeason;
  const capacityActive = seasonCapacity !== null;
  const exceedsSeasonCapacity =
    capacityActive && prospectiveDays > seasonLimit;

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

  const [consentMachineId, setConsentMachineId] = useState<string | null>(null);
  const [agreeChecked, setAgreeChecked] = useState(false);

  function borrowFormError(): string | null {
    if (!startDate || !endDate) {
      return "Please select both start and end dates";
    }
    if (endDate < startDate) {
      return "End date must be on or after start date";
    }
    const days = selectedDurationDays();
    if (days !== null && days > allowedDurationDays) {
      return `Your ${farmSize} ha farm allows at most ${allowedDurationDays} day(s) of machine use (1 day per hectare).`;
    }
    if (exceedsSeasonCapacity) {
      return `This would bring you to ${prospectiveDays} of your ${seasonLimit} machine-day season limit. Cancel one of your current requests first, then resubmit within your limit.`;
    }
    return null;
  }

  function openConsent(machineId: string) {
    const error = borrowFormError();
    if (error) {
      setMessage({ type: "error", text: error });
      return;
    }
    setConsentMachineId(machineId);
    setAgreeChecked(false);
  }

  function closeConsent() {
    setConsentMachineId(null);
    setAgreeChecked(false);
  }

  async function handleBorrow(machineId: string): Promise<boolean> {
    const error = borrowFormError();
    if (error) {
      setMessage({ type: "error", text: error });
      return false;
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
        return true;
      }
      setMessage({ type: "error", text: data.error });
      return false;
    } catch {
      setMessage({ type: "error", text: "Failed to submit request" });
      return false;
    } finally {
      setBorrowing(null);
    }
  }

  async function confirmConsentSubmit() {
    if (!consentMachineId || !agreeChecked) return;
    const ok = await handleBorrow(consentMachineId);
    if (ok) closeConsent();
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
    <div className={memberStyles.surface}>
      <DashboardHeader />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-6">
        <MemberPageHeader title="Shared machinery" description="Browse equipment, choose dates, and follow your requests." />
        {loadError && <div role="alert" className={memberStyles.error}>{loadError}<button onClick={() => void fetchMachines()}>Try again</button></div>}

        {!canBorrow && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-bold">Machine borrowing is not available to you</p>
            <p className="mt-0.5 leading-relaxed">
              A machine-day is drawn from the hectares of a farm you own, and a
              farm worker does not have one of their own. You can still browse
              the equipment below. If your farm role is out of date, you can
              update it in{" "}
              <Link href="/registration" className="font-bold underline">
                Edit Profile
              </Link>
              .
            </p>
          </div>
        )}

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

        {seasonCapacity && (
          (() => {
            const atLimit = bookedInSeason >= seasonLimit;
            const low = !atLimit && remainingInSeason <= 1;
            const state = atLimit ? "limit" : low ? "low" : "ok";
            const fmt = (n: number) =>
              n.toLocaleString("en-US", { maximumFractionDigits: 1 });
            const pct = seasonLimit > 0 ? Math.max(2, Math.min(100, Math.round((bookedInSeason / seasonLimit) * 100))) : 0;
            const accent =
              state === "limit"
                ? { text: "text-[#a8431f]", icon: "bg-red-50 text-red-700", fill: "bg-[#c4522a]", chip: "bg-red-50 text-red-700 border-red-100", bar: "bg-red-50" }
                : state === "low"
                  ? { text: "text-[#9a6a12]", icon: "bg-amber-50 text-amber-700", fill: "bg-[#d9a013]", chip: "bg-amber-50 text-amber-700 border-amber-100", bar: "bg-amber-50" }
                  : { text: "text-[#1d6f3d]", icon: "bg-emerald-50 text-emerald-700", fill: "bg-[#39733e]", chip: "bg-emerald-50 text-emerald-700 border-emerald-100", bar: "bg-emerald-50/60" };
            const chipLabel =
              state === "limit"
                ? "Limit reached"
                : state === "low"
                  ? "Almost at your limit"
                  : `${fmt(remainingInSeason)} day${remainingInSeason === 1 ? "" : "s"} left`;
            return (
              <div className="rounded-2xl border border-[#e2e7dc] border-l-4 bg-white px-4 py-3.5 shadow-sm"
                style={{ borderLeftColor: atLimit ? "#c4522a" : low ? "#d9a013" : "#39733e" }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${accent.icon}`}>
                      <CalendarDays size={15} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#718176]">
                        {seasonCapacity.seasonName} · season capacity
                      </p>
                      <p className="truncate text-xs font-semibold text-[#173a2b]">
                        {fmt(bookedInSeason)} of {fmt(seasonLimit)} machine-day{seasonLimit === 1 ? "" : "s"} booked
                      </p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${accent.chip}`}>
                    {chipLabel}
                  </span>
                </div>

                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className={`font-mono text-3xl font-black leading-none ${accent.text}`}>
                    {fmt(remainingInSeason)}
                  </span>
                  <span className="text-xs font-semibold text-[#5a7267]">
                    machine-days available
                  </span>
                </div>

                <div
                  role="progressbar"
                  aria-valuenow={Math.round(pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#e9efe7]"
                >
                  <div className={`h-full rounded-full ${accent.fill}`} style={{ width: `${pct}%` }} />
                </div>

                <div className="mt-2.5 flex items-center gap-4 text-[11px] font-semibold text-[#5a7267]">
                  <span className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${accent.fill}`} />
                    {fmt(bookedInSeason)} booked
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#c9d6c9]" />
                    {fmt(remainingInSeason)} available
                  </span>
                  {atLimit && (
                    <span className="ml-auto rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                      cancel a request to free days
                    </span>
                  )}
                </div>
              </div>
            );
          })()
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
                            disabled={!canBorrow}
                            title={
                              canBorrow
                                ? undefined
                                : "Machines are borrowed against a farm of your own"
                            }
                            className="shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold bg-[#174b36] text-white hover:bg-[#1a5c42] transition-colors disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 disabled:hover:bg-gray-200"
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

                        <p className="text-xs text-[#718176]">
                          Based on your{" "}
                          <span className="font-semibold text-[#173a2b]">
                            {farmSize} ha
                          </span>{" "}
                          farm, you may borrow a machine for at most{" "}
                          <span className="font-semibold text-[#39733e]">
                            {allowedDurationDays} day
                            {allowedDurationDays > 1 ? "s" : ""}
                          </span>{" "}
                          (1 day per hectare).
                          {selectedDurationDays() !== null && (
                            <span className="block mt-1">
                              Selected:{" "}
                              <span
                                className={`font-semibold ${
                                  exceedsAllowedDuration
                                    ? "text-red-600"
                                    : "text-[#39733e]"
                                }`}
                              >
                                {selectedDurationDays()} day
                                {selectedDurationDays()! > 1 ? "s" : ""}
                              </span>
                            </span>
                          )}
                        </p>
                        {exceedsAllowedDuration && (
                          <p className="text-xs font-semibold text-red-600">
                            This exceeds your allowed duration. Shorten the
                            booking or the request will be rejected.
                          </p>
                        )}

                        {capacityActive && selectedDurationDays() !== null && !exceedsAllowedDuration && (
                          <p className={`text-xs font-semibold ${exceedsSeasonCapacity ? "text-red-600" : "text-[#39733e]"}`}>
                            {exceedsSeasonCapacity ? (
                              <>
                                This request would bring you to{" "}
                                <span className="font-bold">{prospectiveDays}</span> of your{" "}
                                <span className="font-bold">{seasonLimit}</span> machine-day limit for {seasonCapacity!.seasonName}{" "}
                                (you already have {bookedInSeason} booked) — it would exceed your limit. Cancel one of your
                                current requests below, then resubmit within your limit.
                              </>
                            ) : (
                              <>
                                With this request you&apos;ll have{" "}
                                <span className="font-bold">{prospectiveDays}</span> of your{" "}
                                <span className="font-bold">{seasonLimit}</span> machine-day limit booked for{" "}
                                {seasonCapacity!.seasonName} (you already have {bookedInSeason} booked).
                              </>
                            )}
                          </p>
                        )}

                        <div className="flex justify-end gap-2">
                          <button
                            onClick={closeBorrowForm}
                            className="rounded-xl px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-200 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => openConsent(machine.id)}
                            disabled={borrowing === machine.id || !startDate || !endDate || hasDateConflict || exceedsAllowedDuration || exceedsSeasonCapacity}
                            className={`rounded-xl px-5 py-2 text-sm font-bold transition-colors ${
                              borrowing === machine.id || !startDate || !endDate
                                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                : hasDateConflict
                                  ? "bg-red-100 text-red-600 border border-red-300 cursor-not-allowed"
                                  : exceedsAllowedDuration
                                    ? "bg-red-100 text-red-600 border border-red-300 cursor-not-allowed"
                                    : exceedsSeasonCapacity
                                      ? "bg-red-100 text-red-600 border border-red-300 cursor-not-allowed"
                                      : "bg-[#174b36] text-white hover:bg-[#1a5c42]"
                            }`}
                          >
                            {borrowing === machine.id
                              ? "Requesting..."
                              : hasDateConflict
                                ? "Dates conflict with existing booking"
                                : exceedsAllowedDuration
                                  ? "Exceeds allowed duration"
                                  : exceedsSeasonCapacity
                                    ? "Exceeds your season limit"
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
                                  {(!req.startDate || !req.endDate) && <span className="text-xs text-amber-700">Dates not recorded</span>}
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
            ) : !loadError ? (
              <div className="rounded-2xl border border-dashed border-[#ccd9c8] bg-white p-5 text-center text-sm text-[#718176]">
                No machines available at the moment
              </div>
            ) : null}
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

      {consentMachineId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl max-h-[90vh]">
            <div className="flex items-start justify-between gap-3 border-b border-[#eef2e8] px-6 pb-4 pt-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <FileCheck size={19} />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Borrow request terms
                  </h3>
                  <p className="text-xs text-gray-500">
                    Review and accept before submitting.
                  </p>
                </div>
              </div>
              <button
                onClick={closeConsent}
                disabled={borrowing === consentMachineId}
                className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4 text-sm text-gray-600">
              {[
                "Machines are for your own farm use only, during the exact dates you booked.",
                "Each day booked counts toward your seasonal machine-day limit (1 hectare = 1 machine-day). Pending and approved requests reserve those days until cancelled, rejected, or returned.",
                "Your request is sent to the secretary for review — it is not confirmed until approved.",
                "Once approved, confirm pickup to take possession of the machine.",
                "You are responsible for the machine while it is in your possession. Return it on time and in reasonable condition; the secretary confirms the return.",
                "Report any damage or issues to the cooperative immediately.",
                "You can cancel a pending request at any time; cancelling or a rejection frees its machine-days again.",
              ].map((term) => (
                <p key={term} className="flex items-start gap-2.5">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-emerald-600" />
                  {term}
                </p>
              ))}
            </div>

            <div className="border-t border-[#eef2e8] px-6 py-4">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={agreeChecked}
                  onChange={(e) => setAgreeChecked(e.target.checked)}
                  disabled={borrowing === consentMachineId}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                  style={{ accentColor: "#39733e" }}
                />
                <span className="text-sm font-semibold text-[#173a2b]">
                  I have read and agree to the terms above
                </span>
              </label>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={closeConsent}
                disabled={borrowing === consentMachineId}
                className="flex-1 rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-600 transition hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmConsentSubmit}
                disabled={!agreeChecked || borrowing === consentMachineId}
                className={`flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white transition disabled:opacity-50 ${
                  borrowing === consentMachineId
                    ? "bg-[#174b36]"
                    : "bg-[#174b36] hover:bg-[#1a5c42] active:scale-[0.99]"
                }`}
              >
                {borrowing === consentMachineId
                  ? "Submitting..."
                  : "Agree & Submit Request"}
              </button>
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
