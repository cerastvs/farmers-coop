"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Wheat,
  X,
} from "lucide-react";

export interface HarvestSeasonsData {
  seasons: { id: string; name: string; startMonth: number; startDay: number }[];
  current: { id: string; name: string; start: string; end: string } | null;
  next: { id: string; name: string; start: string; end: string } | null;
  machines: { id: string; name: string }[];
  capacities: {
    seasonId: string;
    machineId: string;
    maxHectareDays: number | null;
  }[];
  usage: { machineId: string; seasonId: string; bookedHectareDays: number }[];
  empty: boolean;
}

type Notice = { kind: "success" | "error"; text: string } | null;

const SEASON_BAR_COLORS = [
  "bg-lime-400",
  "bg-sky-400",
  "bg-amber-400",
  "bg-violet-400",
  "bg-rose-400",
];

const SEASON_DOT_COLORS = [
  "bg-lime-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
];

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function isValidMonthDay(month: number, day: number) {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  const max = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= max;
}

function activeSeasonForMonth(
  seasons: HarvestSeasonsData["seasons"],
  year: number,
  month: number,
) {
  const probe = new Date(year, month, 15, 0, 0, 0, 0);
  let best: { season: HarvestSeasonsData["seasons"][number]; start: Date } | null = null;
  for (const season of seasons) {
    for (const y of [year, year - 1]) {
      const start = new Date(y, season.startMonth - 1, season.startDay);
      if (start.getTime() <= probe.getTime() && (!best || start.getTime() > best.start.getTime())) {
        best = { season, start };
      }
    }
  }
  return best?.season ?? null;
}

function seasonLabel(data: HarvestSeasonsData | null, seasonId: string) {
  return data?.seasons.find((s) => s.id === seasonId);
}

function formatShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysInPeriod(start: string, end: string) {
  return Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / (24 * 60 * 60 * 1000),
  );
}

export function HarvestSeasonPanel({
  data,
  onReload,
}: {
  data: HarvestSeasonsData | null;
  onReload: () => void;
}) {
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addMonth, setAddMonth] = useState(1);
  const [addDay, setAddDay] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editMonth, setEditMonth] = useState(1);
  const [editDay, setEditDay] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const seasons = data?.seasons ?? [];
  const selectedSeason = seasonLabel(data, selectedSeasonId ?? "") ?? null;

  useEffect(() => {
    if (selectedSeasonId && seasons.some((s) => s.id === selectedSeasonId)) return;
    const preferred = data?.current?.id ?? seasons[0]?.id ?? null;
    setSelectedSeasonId(preferred);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, seasons.length]);

  const capacityRows = useMemo(() => {
    const rows = new Map<string, number | null>();
    for (const c of data?.capacities ?? []) {
      if (c.seasonId === selectedSeasonId) rows.set(c.machineId, c.maxHectareDays);
    }
    return rows;
  }, [data, selectedSeasonId]);

  const usageByMachine = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of data?.usage ?? []) {
      if (u.seasonId === selectedSeasonId) map.set(u.machineId, u.bookedHectareDays);
    }
    return map;
  }, [data, selectedSeasonId]);

  useEffect(() => {
    if (!selectedSeasonId) return;
    const next: Record<string, string> = {};
    for (const m of data?.machines ?? []) {
      const v = capacityRows.get(m.id);
      next[m.id] = v === null || v === undefined ? "" : String(v);
    }
    setDraft(next);
  }, [data, selectedSeasonId, capacityRows]);

  function flash(kind: "success" | "error", text: string) {
    setNotice({ kind, text });
  }

  async function run(
    key: string,
    fn: () => Promise<Response>,
    successMessage: string,
  ): Promise<boolean> {
    setBusy(key);
    try {
      const res = await fn();
      const result = await res.json().catch(() => ({}));
      if (res.ok) {
        flash("success", result.message ?? successMessage);
        if (onReload) onReload();
        return true;
      }
      flash("error", result.error ?? "Something went wrong");
      return false;
    } catch {
      flash("error", "Network error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function handleBootstrap() {
    await run("bootstrap", () => fetch("/api/seasons/bootstrap", { method: "POST" }), "Default seasons created");
  }

  async function handleAddSeason() {
    if (!isValidMonthDay(addMonth, addDay)) {
      flash("error", "Invalid start date");
      return;
    }
    const ok = await run("add", () =>
      fetch("/api/seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName.trim(), startMonth: addMonth, startDay: addDay }),
      }),
      "Season created");
    if (ok) {
      setShowAdd(false);
      setAddName("");
      setAddMonth(1);
      setAddDay(1);
    }
  }

  async function handleUpdateSeason() {
    if (!editingId) return;
    if (!isValidMonthDay(editMonth, editDay)) {
      flash("error", "Invalid start date");
      return;
    }
    const ok = await run("edit", () =>
      fetch(`/api/seasons/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), startMonth: editMonth, startDay: editDay }),
      }),
      "Season updated");
    if (ok) setEditingId(null);
  }

  async function handleDeleteSeason() {
    if (!deletingId) return;
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    const ok = await run("delete", () => fetch(`/api/seasons/${deletingId}`, { method: "DELETE" }), "Season removed");
    if (ok) {
      setDeletingId(null);
      setDeleteConfirm(false);
    }
  }

  async function handleSaveCapacities() {
    if (!selectedSeasonId || !data) return;
    const capacityRowsPayload = data.machines.map((m) => {
      const raw = draft[m.id]?.trim();
      if (raw === "") return { machineId: m.id, maxHectareDays: null };
      const num = Number(raw);
      if (!Number.isFinite(num) || num < 0) return null;
      return { machineId: m.id, maxHectareDays: num };
    });
    if (capacityRowsPayload.some((c) => c === null)) {
      flash("error", "Enter valid non-negative numbers, or leave blank for no limit");
      return;
    }
    await run("cap", () =>
      fetch(`/api/seasons/${selectedSeasonId}/capacities`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capacities: capacityRowsPayload }),
      }),
      "Capacity limits saved");
  }

  function startEdit(season: HarvestSeasonsData["seasons"][number]) {
    setEditingId(season.id);
    setEditName(season.name);
    setEditMonth(season.startMonth);
    setEditDay(season.startDay);
  }

  const displayYear =
    (data?.next ? new Date(data.next.start).getFullYear() : undefined) ??
    (data?.current ? new Date(data.current.start).getFullYear() : undefined) ??
    new Date().getFullYear();

  const renderSeasonCards = () => {
    if (!data) return null;
    const cards = [
      {
        key: "current",
        title: "Current Season",
        instance: data.current,
        caption: data.current
          ? `Running · ${formatShort(data.current.start)} to ${formatShort(new Date(new Date(data.current.end).getTime() - 86400000).toISOString())}`
          : "No season currently in progress",
        highlight: data.current ? "border-lime-400" : "",
        dot: "bg-lime-500",
      },
      {
        key: "next",
        title: "Next Season",
        instance: data.next,
        caption: data.next
          ? `Starts in ${daysInPeriod(new Date().toISOString(), data.next.start)} days · ${formatShort(data.next.start)}`
          : "No upcoming season configured",
        highlight: data.next ? "border-amber-400" : "",
        dot: "bg-amber-500",
      },
    ];
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => {
          const inst = card.instance;
          const days = inst
            ? daysInPeriod(inst.start, inst.end)
            : null;
          return (
            <div key={card.key} className={`rounded-xl border border-[#e2ebe6] bg-[#fafdf9] p-4 shadow-sm border-l-4 ${card.highlight}`}>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${card.dot}`} />
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#5a7267]">{card.title}</h4>
              </div>
              <p className="mt-1.5 text-lg font-bold text-[#0f2318]">{inst?.name ?? "—"}</p>
              <p className="mt-1 text-xs text-[#5a7267]">{card.caption}</p>
              {days !== null && (
                <p className="mt-1 text-[11px] font-medium text-[#718176]">{days} days in the season</p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderCalendar = () => {
    if (data && data.seasons.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-1">
          {MONTH_LABELS.map((label, i) => {
            const active = activeSeasonForMonth(seasons, displayYear, i);
            const color = active
              ? SEASON_BAR_COLORS[seasons.findIndex((s) => s.id === active.id) % SEASON_BAR_COLORS.length]
              : "bg-[#eef3ee]";
            return (
              <div key={label} className="flex flex-col items-center">
                <span className={`mb-1 h-9 w-full rounded-md ${color} opacity-90 transition hover:opacity-100`} title={active?.name ?? "Unassigned"} />
                <span className="text-[9px] font-semibold text-[#5a7267]">{label}</span>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
          {seasons.map((season, i) => {
            const color = SEASON_DOT_COLORS[i % SEASON_DOT_COLORS.length];
            const isCurrent = data?.current?.id === season.id;
            return (
              <span key={season.id} className="flex items-center gap-1.5 text-[11px] text-[#5a7267]">
                <span className={`h-2 w-2 rounded-full ${color}`} />
                {season.name}
                {isCurrent && <span className="rounded-full bg-lime-100 px-1.5 text-[9px] font-bold text-lime-700">now</span>}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  const renderEmptyState = () => (
    <div className="rounded-xl border border-dashed border-[#dce5d9] bg-[#fafdf9] p-6 text-center">
      <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl bg-lime-100 text-lime-700">
        <Wheat size={20} />
      </div>
      <h3 className="text-sm font-bold text-[#0f2318]">No harvest seasons configured</h3>
      <p className="mx-auto mt-1 max-w-md text-xs text-[#5a7267]">
        Set up the planting and harvest calendar. The default is a Wet Season (May 1) and a Dry
        Season (Nov 1) that repeat every year — each season runs until the next one begins, so the
        year is always fully covered. You can add, rename, or remove seasons however you like.
      </p>
      <button
        onClick={handleBootstrap}
        disabled={busy === "bootstrap"}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1b5e3b] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#144b2e] active:scale-[0.99] disabled:opacity-60"
      >
        {busy === "bootstrap" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        Set up default Wet &amp; Dry seasons
      </button>
    </div>
  );

  const renderSeasonManagement = () => {
    if (!data || data.seasons.length === 0) return null;
    return (
      <div className="rounded-xl border border-[#e2ebe6] bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#0f2318]">Season Calendar</h3>
            <p className="text-[11px] text-[#5a7267]">
              Repeats yearly · {data.seasons.length} season{data.seasons.length > 1 ? "s" : ""} · {displayYear}
            </p>
          </div>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#1b5e3b] bg-[#1b5e3b] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#144b2e] active:scale-[0.99]"
          >
            {showAdd ? <X size={13} /> : <Plus size={13} />}
            {showAdd ? "Cancel" : "Add season"}
          </button>
        </div>

        {showAdd && (
          <div className="mb-4 rounded-lg border border-[#e2ebe6] bg-[#fafdf9] p-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-[10px] font-semibold text-[#5a7267]">
                Name
                <input
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Wet Season"
                  className="w-44 rounded-md border border-[#dce5d9] px-2.5 py-1.5 text-xs text-[#0f2318] outline-none focus:border-[#1b5e3b]"
                />
              </label>
              <label className="flex flex-col gap-1 text-[10px] font-semibold text-[#5a7267]">
                Month
                <select value={addMonth} onChange={(e) => setAddMonth(Number(e.target.value))} className="rounded-md border border-[#dce5d9] px-2 py-1.5 text-xs text-[#0f2318] outline-none focus:border-[#1b5e3b]">
                  {MONTH_LABELS.map((label, i) => (
                    <option key={i + 1} value={i + 1}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[10px] font-semibold text-[#5a7267]">
                Day
                <select value={addDay} onChange={(e) => setAddDay(Number(e.target.value))} className="rounded-md border border-[#dce5d9] px-2 py-1.5 text-xs text-[#0f2318] outline-none focus:border-[#1b5e3b]">
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </label>
              <button
                onClick={handleAddSeason}
                disabled={busy === "add" || addName.trim() === ""}
                className="rounded-md bg-[#1b5e3b] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#144b2e] active:scale-[0.99] disabled:opacity-50"
              >
                {busy === "add" ? <Loader2 size={13} className="animate-spin" /> : "Create"}
              </button>
            </div>
            <p className="mt-2 text-[10px] text-[#718176]">
              The new season runs from its start date until the next season begins; the neighboring
              season&apos;s boundary adjusts automatically.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {data.seasons.map((season, i) => {
            const isCurrent = data.current?.id === season.id;
            const isEditing = editingId === season.id;
            const isDeleting = deletingId === season.id;
            return (
              <div key={season.id} className={`rounded-lg border ${isCurrent ? "border-lime-300 bg-lime-50/40" : "border-[#e2ebe6] bg-[#fafdf9]"} p-3`}>
                {isEditing ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1 text-[10px] font-semibold text-[#5a7267]">
                      Name
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-40 rounded-md border border-[#dce5d9] px-2.5 py-1.5 text-xs text-[#0f2318] outline-none focus:border-[#1b5e3b]" />
                    </label>
                    <label className="flex flex-col gap-1 text-[10px] font-semibold text-[#5a7267]">
                      Month
                      <select value={editMonth} onChange={(e) => setEditMonth(Number(e.target.value))} className="rounded-md border border-[#dce5d9] px-2 py-1.5 text-xs text-[#0f2318] outline-none focus:border-[#1b5e3b]">
                        {MONTH_LABELS.map((label, m) => (
                          <option key={m + 1} value={m + 1}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-[10px] font-semibold text-[#5a7267]">
                      Day
                      <select value={editDay} onChange={(e) => setEditDay(Number(e.target.value))} className="rounded-md border border-[#dce5d9] px-2 py-1.5 text-xs text-[#0f2318] outline-none focus:border-[#1b5e3b]">
                        {Array.from({ length: 31 }, (_, d) => (
                          <option key={d + 1} value={d + 1}>{d + 1}</option>
                        ))}
                      </select>
                    </label>
                    <button onClick={handleUpdateSeason} disabled={busy === "edit"} className="rounded-md bg-[#1b5e3b] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#144b2e] disabled:opacity-50">
                      {busy === "edit" ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                    </button>
                    <button onClick={() => setEditingId(null)} className="rounded-md border border-[#dce5d9] px-3 py-1.5 text-xs text-[#5a7267] hover:bg-white">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${SEASON_DOT_COLORS[i % SEASON_DOT_COLORS.length]}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0f2318]">
                          {season.name}
                          {isCurrent && <span className="ml-2 rounded-full bg-lime-100 px-1.5 py-0.5 text-[9px] font-bold text-lime-700">in progress</span>}
                        </p>
                        <p className="text-[11px] text-[#5a7267]">
                          Starts {formatShort(new Date(displayYear, season.startMonth - 1, season.startDay).toISOString())}
                          {isCurrent ? " · expanding/editing shifts boundaries automatically" : " · moving it shifts the neighbor boundaries"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedSeasonId(season.id)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition active:scale-[0.98] ${selectedSeasonId === season.id ? "bg-[#1b5e3b] text-white" : "text-[#5a7267] hover:bg-[#eef3ee]"}`}
                      >
                        Capacity
                      </button>
                      <button onClick={() => startEdit(season)} className="rounded-md p-1.5 text-[#5a7267] transition hover:bg-[#eef3ee] hover:text-[#1b5e3b]" title="Edit season">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => { setDeletingId(season.id); setDeleteConfirm(false); }} className="rounded-md p-1.5 text-[#5a7267] transition hover:bg-red-50 hover:text-red-600" title="Remove season">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {isDeleting && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-red-200 bg-red-50 p-2">
                    {deleteConfirm ? (
                      <>
                        <span className="text-[11px] font-semibold text-red-700">
                          Really remove this season? Its period merges into the previous season.
                        </span>
                        <button onClick={handleDeleteSeason} disabled={busy === "delete"} className="rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-700 disabled:opacity-50">
                          {busy === "delete" ? <Loader2 size={12} className="animate-spin" /> : "Yes, remove"}
                        </button>
                        <button onClick={() => setDeletingId(null)} className="rounded-md border border-[#dce5d9] bg-white px-2.5 py-1 text-[11px] text-[#5a7267] hover:bg-gray-50">
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={13} className="text-red-600" />
                        <span className="text-[11px] text-red-700">
                          {isCurrent
                            ? "This is the season currently in progress and cannot be removed yet."
                            : "Remove this season? Its period automatically merges into the previous season."}
                        </span>
                        {!isCurrent && (
                          <button onClick={handleDeleteSeason} className="rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-700">
                            Remove
                          </button>
                        )}
                        <button onClick={() => setDeletingId(null)} className="rounded-md border border-[#dce5d9] bg-white px-2.5 py-1 text-[11px] text-[#5a7267] hover:bg-gray-50">
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const selectedIndex = selectedSeason ? seasons.findIndex((s) => s.id === selectedSeason.id) : -1;
  const selectedBar = selectedIndex >= 0 ? SEASON_BAR_COLORS[selectedIndex % SEASON_BAR_COLORS.length] : "bg-gray-300";

  const renderCapacity = () => {
    if (!data || !data.machines.length || !selectedSeason) return null;
    return (
      <div className="rounded-xl border border-[#e2ebe6] bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#0f2318]">Machine Capacity</h3>
            <p className="text-[11px] text-[#5a7267]">
              Hectare-day limits for{" "}
              <span className="font-semibold text-[#0f2318]">{selectedSeason.name}</span>, shared across
              all members and reset automatically when the next season begins.
            </p>
          </div>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5a7267]">
            <span className={`h-2.5 w-2.5 rounded-full ${selectedBar}`} />
            Viewing
            <select
              value={selectedSeason.id}
              onChange={(e) => setSelectedSeasonId(e.target.value)}
              className="rounded-md border border-[#dce5d9] px-2 py-1 text-xs text-[#0f2318] outline-none focus:border-[#1b5e3b]"
            >
              {data.seasons.map((season) => (
                <option key={season.id} value={season.id}>{season.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-wider text-[#5a7267]">
                <th className="py-2 pr-3">Machine</th>
                <th className="py-2 pr-3">Booked (ha-days)</th>
                <th className="py-2 pr-3">Capacity limit (ha-days)</th>
                <th className="py-2">Utilization</th>
              </tr>
            </thead>
            <tbody>
              {data.machines.map((machine) => {
                const booked = usageByMachine.get(machine.id) ?? 0;
                const limitRaw = capacityRows.get(machine.id) ?? null;
                const limitSet = limitRaw !== null && limitRaw !== undefined;
                const max = limitSet ? limitRaw : null;
                const pct = max ? Math.min(100, Math.round((booked / max) * 100)) : 0;
                const over = max !== null && booked > max;
                return (
                  <tr key={machine.id} className="border-t border-[#eef3ee]">
                    <td className="py-2.5 pr-3 text-sm font-medium text-[#0f2318]">{machine.name}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`font-mono text-sm font-bold ${over ? "text-red-600" : "text-[#0f2318]"}`}>
                        {booked.toLocaleString("en-US", { maximumFractionDigits: 1 })}
                      </span>
                      {over && <span className="ml-1.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-600">over limit</span>}
                    </td>
                    <td className="py-2.5 pr-3">
                      <input
                        key={`${selectedSeason.id}:${machine.id}`}
                        type="number"
                        min="0"
                        step="any"
                        value={draft[machine.id] ?? ""}
                        onChange={(e) => setDraft((prev) => ({ ...prev, [machine.id]: e.target.value }))}
                        placeholder="Unlimited"
                        className="w-28 rounded-md border border-[#dce5d9] px-2.5 py-1.5 text-xs text-[#0f2318] outline-none focus:border-[#1b5e3b]"
                      />
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#eef3ee]">
                          <div className={`h-full rounded-full ${over ? "bg-red-500" : "bg-[#1b5e3b]"}`} style={{ width: `${max ? Math.max(2, Math.min(100, pct)) : 3}%` }} />
                        </div>
                        <span className="text-[10px] font-semibold text-[#5a7267]">
                          {max ? `${pct}%` : "no limit"}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="max-w-md text-[10px] text-[#718176]">
            Booked hectare-days are computed live from active borrow requests (approved, in use, or
            overdue) whose start falls within this season. Clearing the limit field removes the cap.
          </p>
          <button
            onClick={handleSaveCapacities}
            disabled={busy === "cap"}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#1b5e3b] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#144b2e] active:scale-[0.99] disabled:opacity-60"
          >
            {busy === "cap" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save capacity
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {notice && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${notice.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          {notice.text}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-lime-100 text-lime-700">
          <Wheat size={22} />
        </div>
        <div>
          <h3 className="text-base font-bold text-[#0f2318]">Harvest Season Management</h3>
          <p className="text-xs text-[#5a7267]">Plan the yearly calendar and machine capacity limits (President only)</p>
        </div>
      </div>

      {data === null ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-[#e2ebe6] bg-white">
          <Loader2 size={18} className="animate-spin text-[#1b5e3b]" />
        </div>
      ) : data.empty ? (
        renderEmptyState()
      ) : (
        <>
          {renderSeasonCards()}
          {renderCalendar()}
          {renderSeasonManagement()}
          {renderCapacity()}
        </>
      )}
    </div>
  );
}