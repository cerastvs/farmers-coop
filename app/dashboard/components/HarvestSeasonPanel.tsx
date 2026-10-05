"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wheat,
  X,
} from "lucide-react";

type Season = {
  id: string;
  name: string;
  startMonth: number;
  startDay: number;
  color: string | null;
};

type CapacityRow = {
  seasonId: string;
  userId: string;
  name: string;
  limitHectareDays: number | null;
  bookedHectareDays: number;
  remaining: number | null;
  utilizationPercent: number | null;
};

export type HarvestSeasonsData = {
  seasons: Season[];
  current: null | {
    id: string;
    name: string;
    start: string;
    end: string;
  };
  next: null | {
    id: string;
    name: string;
    start: string;
    end: string;
  };
  members: Array<{
    id: string;
    name: string;
    farmHectares: number;
  }>;
  capacity: CapacityRow[];
  empty: boolean;
};

type Props = {
  data: HarvestSeasonsData | null;
  onReload: () => void;
};

type EditorState = {
  mode: "create" | "edit";
  id?: string;
  name: string;
  startMonth: number;
  endMonth?: number;
  color: string;
};

type Notice = { type: "success" | "error"; text: string } | null;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_SHORT = MONTHS.map((month) => month.slice(0, 3));

const SEASON_COLORS = [
  "#356859",
  "#c0934d",
  "#6f8e9c",
  "#9a6b58",
  "#6f7e4e",
  "#7d7084",
];

function seasonColor(season: Season, index: number) {
  return season.color && /^#[0-9a-fA-F]{6}$/.test(season.color)
    ? season.color
    : SEASON_COLORS[index % SEASON_COLORS.length];
}

function colorText(hex: string) {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.66 ? "#173b31" : "#ffffff";
}

function formatIsoDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatPeriod(start: string, endExclusive: string) {
  const end = new Date(endExclusive);
  end.setDate(end.getDate() - 1);
  return `${formatIsoDate(start)} - ${formatIsoDate(end.toISOString())}`;
}

function daysUntil(value: string) {
  return Math.max(
    0,
    Math.ceil((new Date(value).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );
}

function dayOfYear(month: number, day: number) {
  return Math.floor(
    (Date.UTC(2025, month - 1, day) - Date.UTC(2025, 0, 1)) /
      (24 * 60 * 60 * 1000),
  );
}

function endMonthFor(seasons: Season[], index: number) {
  if (seasons.length === 0) return 1;
  const next = seasons[(index + 1) % seasons.length];
  return next.startDay === 1
    ? next.startMonth === 1
      ? 12
      : next.startMonth - 1
    : next.startMonth;
}

function monthRangeLabel(seasons: Season[], index: number) {
  return `${MONTH_SHORT[seasons[index].startMonth - 1]} - ${MONTH_SHORT[endMonthFor(seasons, index) - 1]}`;
}

function buildYearSegments(seasons: Season[]) {
  if (seasons.length === 0) return [];
  const sorted = [...seasons].sort(
    (a, b) => dayOfYear(a.startMonth, a.startDay) - dayOfYear(b.startMonth, b.startDay),
  );
  const starts = new Map(sorted.map((season) => [dayOfYear(season.startMonth, season.startDay), season]));
  const boundaries = [
    0,
    ...sorted.map((season) => dayOfYear(season.startMonth, season.startDay)).filter((day) => day > 0),
    365,
  ];
  return boundaries.slice(0, -1).map((start, index) => ({
    season: starts.get(start) ?? sorted[sorted.length - 1],
    start,
    days: boundaries[index + 1] - start,
  }));
}

export function HarvestSeasonPanel({ data, onReload }: Props) {
  const [view, setView] = useState<"schedule" | "usage">("schedule");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<"save" | "delete" | "bootstrap" | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Season | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [usageQuery, setUsageQuery] = useState("");

  useEffect(() => {
    if (!data?.seasons.length) return;
    setSelectedSeasonId((current) => {
      if (current && data.seasons.some((season) => season.id === current)) return current;
      return data.current?.id ?? data.seasons[0].id;
    });
  }, [data]);

  const sortedSeasons = useMemo(
    () =>
      [...(data?.seasons ?? [])].sort(
        (a, b) => dayOfYear(a.startMonth, a.startDay) - dayOfYear(b.startMonth, b.startDay),
      ),
    [data?.seasons],
  );
  const yearSegments = useMemo(() => buildYearSegments(sortedSeasons), [sortedSeasons]);
  const selectedCapacity = (data?.capacity ?? []).filter(
    (row) => row.seasonId === selectedSeasonId,
  );
  const visibleCapacity = selectedCapacity.filter((row) =>
    row.name.toLowerCase().includes(usageQuery.trim().toLowerCase()),
  );
  const selectedSeason = data?.seasons.find((season) => season.id === selectedSeasonId) ?? null;

  async function request(
    url: string,
    init: RequestInit,
    busyState: NonNullable<typeof busy>,
    successMessage: string,
  ) {
    setBusy(busyState);
    setNotice(null);
    try {
      const response = await fetch(url, init);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Something went wrong.");
      setNotice({ type: "success", text: payload.message ?? successMessage });
      onReload();
      return true;
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Something went wrong.",
      });
      return false;
    } finally {
      setBusy(null);
    }
  }

  function openCreate() {
    const today = new Date();
    setEditor({
      mode: "create",
      name: "",
      startMonth: today.getMonth() + 1,
      color: SEASON_COLORS[sortedSeasons.length % SEASON_COLORS.length],
    });
    setDeleteTarget(null);
  }

  function openEdit(season: Season) {
    const index = sortedSeasons.findIndex((item) => item.id === season.id);
    setEditor({
      mode: "edit",
      id: season.id,
      name: season.name,
      startMonth: season.startMonth,
      endMonth: endMonthFor(sortedSeasons, index),
      color: seasonColor(season, index),
    });
    setDeleteTarget(null);
  }

  async function saveSeason() {
    if (!editor) return;
    const name = editor.name.trim();
    if (!name) {
      setNotice({ type: "error", text: "Enter a season name." });
      return;
    }
    const isEditing = editor.mode === "edit";
    const saved = await request(
      isEditing ? `/api/seasons/${editor.id}` : "/api/seasons",
      {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          startMonth: editor.startMonth,
          startDay: 1,
          color: editor.color,
          ...(isEditing ? { endMonth: editor.endMonth } : {}),
        }),
      },
      "save",
      isEditing ? "Season updated." : "Season added.",
    );
    if (saved) setEditor(null);
  }

  async function removeSeason() {
    if (!deleteTarget) return;
    const removed = await request(
      `/api/seasons/${deleteTarget.id}`,
      { method: "DELETE" },
      "delete",
      "Season removed.",
    );
    if (removed) setDeleteTarget(null);
  }

  async function createDefaults() {
    await request(
      "/api/seasons/bootstrap",
      { method: "POST" },
      "bootstrap",
      "Wet and dry seasons are ready.",
    );
  }

  function renderEditor() {
    if (!editor) return null;
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void saveSeason();
        }}
        className="mb-4 border border-[#b9c5b9] bg-[#fffefa] p-4"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="font-['Barlow_Condensed',sans-serif] text-lg font-bold text-[#173b31]">
              {editor.mode === "create" ? "Add season" : "Edit season"}
            </p>
            <p className="text-xs text-[#65736d]">
              {editor.mode === "edit"
                ? `The following season will start in ${MONTHS[editor.endMonth! % 12]}.`
                : "The new season will run until the next season begins."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditor(null)}
            className="grid h-9 w-9 place-items-center border border-[#c9d0c9] text-[#53615b] transition hover:bg-[#eef1e9] hover:text-[#173b31]"
            aria-label="Close season editor"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(180px,1fr)_150px_150px_86px_auto] lg:items-end">
          <label className="space-y-1.5">
            <span className="block text-[11px] font-bold uppercase text-[#65736d]">Season name</span>
            <input
              value={editor.name}
              onChange={(event) =>
                setEditor((current) => (current ? { ...current, name: event.target.value } : current))
              }
              placeholder="e.g. Wet Season"
              autoFocus
              className="h-10 w-full border border-[#b9c5b9] bg-white px-3 text-sm text-[#173b31] outline-none transition focus:border-[#356859] focus:ring-2 focus:ring-[#356859]/15"
            />
          </label>
          <label className="space-y-1.5">
            <span className="block text-[11px] font-bold uppercase text-[#65736d]">
              {editor.mode === "edit" ? "From month" : "Starts in"}
            </span>
            <select
              value={editor.startMonth}
              onChange={(event) =>
                setEditor((current) =>
                  current
                    ? { ...current, startMonth: Number(event.target.value) }
                    : current,
                )
              }
              className="h-10 w-full border border-[#b9c5b9] bg-white px-3 text-sm text-[#173b31] outline-none focus:border-[#356859]"
            >
              {MONTHS.map((month, index) => (
                <option key={month} value={index + 1}>{month}</option>
              ))}
            </select>
          </label>
          {editor.mode === "edit" ? (
            <label className="space-y-1.5">
              <span className="block text-[11px] font-bold uppercase text-[#65736d]">To month</span>
              <select
                value={editor.endMonth}
                onChange={(event) =>
                  setEditor((current) =>
                    current
                      ? { ...current, endMonth: Number(event.target.value) }
                      : current,
                  )
                }
                className="h-10 w-full border border-[#b9c5b9] bg-white px-3 text-sm text-[#173b31] outline-none focus:border-[#356859]"
              >
                {MONTHS.map((month, index) => (
                  <option key={month} value={index + 1}>{month}</option>
                ))}
              </select>
            </label>
          ) : (
            <div className="hidden lg:block" />
          )}
          <label className="space-y-1.5">
            <span className="block text-[11px] font-bold uppercase text-[#65736d]">Map color</span>
            <div className="flex h-10 items-center gap-2 border border-[#b9c5b9] bg-white px-2">
              <input
                type="color"
                value={editor.color}
                onChange={(event) =>
                  setEditor((current) =>
                    current ? { ...current, color: event.target.value } : current,
                  )
                }
                className="h-7 w-9 cursor-pointer border-0 bg-transparent p-0"
                aria-label="Season map color"
                title="Choose map color"
              />
              <span className="font-mono text-[10px] uppercase text-[#65736d]">
                {editor.color}
              </span>
            </div>
          </label>
          <button
            type="submit"
            disabled={busy === "save"}
            className="inline-flex h-10 items-center justify-center gap-2 bg-[#173b31] px-4 text-sm font-bold text-white transition hover:bg-[#245444] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save
          </button>
        </div>
      </form>
    );
  }

  function renderSchedule() {
    return (
      <div>
        {renderEditor()}
        <div className="overflow-hidden border border-[#c9d0c9] bg-[#fffefa]">
          <div className="hidden grid-cols-[minmax(180px,1fr)_180px_88px] border-b border-[#c9d0c9] bg-[#eef1e9] px-4 py-2 text-[10px] font-bold uppercase text-[#65736d] md:grid">
            <span>Season</span><span>Months</span><span className="text-right">Actions</span>
          </div>
          {sortedSeasons.map((season, index) => {
            const isCurrent = season.id === data?.current?.id;
            return (
              <div
                key={season.id}
                className="grid gap-3 border-b border-[#dde2dc] px-4 py-3 last:border-b-0 md:grid-cols-[minmax(180px,1fr)_180px_88px] md:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 border border-black/10"
                      style={{
                        backgroundColor:
                          editor?.mode === "edit" && editor.id === season.id
                            ? editor.color
                            : seasonColor(season, index),
                      }}
                      aria-hidden="true"
                    />
                    <p className="truncate text-sm font-bold text-[#173b31]">{season.name}</p>
                    {isCurrent ? (
                      <span className="bg-[#d7e2b0] px-2 py-0.5 text-[10px] font-bold uppercase text-[#173b31]">Current</span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-[#7a857f] md:hidden">
                    {monthRangeLabel(sortedSeasons, index)}
                  </p>
                </div>
                <p className="hidden font-mono text-sm font-bold text-[#53615b] md:block">
                  {monthRangeLabel(sortedSeasons, index)}
                </p>
                <div className="flex items-center gap-2 md:justify-end">
                  <button
                    type="button"
                    onClick={() => openEdit(season)}
                    className="grid h-9 w-9 place-items-center border border-[#c9d0c9] text-[#53615b] transition hover:border-[#356859] hover:bg-[#eef1e9] hover:text-[#173b31]"
                    aria-label={`Edit ${season.name}`}
                    title="Edit season"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(season)}
                    disabled={isCurrent}
                    className="grid h-9 w-9 place-items-center border border-[#c9d0c9] text-[#7b655f] transition hover:border-[#b44b3e] hover:bg-[#fff1ed] hover:text-[#9d352b] disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label={`Remove ${season.name}`}
                    title={isCurrent ? "The current season cannot be removed" : "Remove season"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderUsage() {
    const usedTotal = selectedCapacity.reduce(
      (sum, row) => sum + row.bookedHectareDays,
      0,
    );
    const limitTotal = selectedCapacity.reduce(
      (sum, row) => sum + (row.limitHectareDays ?? 0),
      0,
    );
    const missingFarmSize = selectedCapacity.filter(
      (row) => row.limitHectareDays === null,
    ).length;
    return (
      <div>
        <div className="mb-4 flex flex-col gap-3 border-b border-[#c9d0c9] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <label className="space-y-1.5">
            <span className="block text-[11px] font-bold uppercase text-[#65736d]">Season</span>
            <select
              value={selectedSeasonId}
              onChange={(event) => setSelectedSeasonId(event.target.value)}
              className="h-10 min-w-56 border border-[#b9c5b9] bg-white px-3 text-sm font-semibold text-[#173b31] outline-none focus:border-[#356859]"
            >
              {sortedSeasons.map((season, index) => (
                <option key={season.id} value={season.id}>{season.name} - {monthRangeLabel(sortedSeasons, index)}</option>
              ))}
            </select>
          </label>
          <label className="relative block sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a857f]" />
            <span className="sr-only">Search members</span>
            <input
              value={usageQuery}
              onChange={(event) => setUsageQuery(event.target.value)}
              placeholder="Search members"
              className="h-10 w-full border border-[#b9c5b9] bg-white pl-9 pr-3 text-sm text-[#173b31] outline-none focus:border-[#356859]"
            />
          </label>
        </div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-bold text-[#173b31]">{selectedSeason?.name ?? "Season"} usage</p>
          <p className="font-mono text-xs text-[#65736d]">
            {selectedCapacity.length} members · {usedTotal.toFixed(1)} of {limitTotal.toFixed(1)} days used
            {missingFarmSize > 0 ? ` · ${missingFarmSize} need farm size` : ""}
          </p>
        </div>
        {visibleCapacity.length === 0 ? (
          <div className="border border-[#c9d0c9] bg-[#fffefa] px-4 py-8 text-center text-sm text-[#7a857f]">
            No members found.
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#c9d0c9] bg-[#fffefa]">
            <table className="w-full min-w-[620px] border-collapse text-left">
            <thead className="bg-[#eef1e9] text-[10px] font-bold uppercase text-[#65736d]">
              <tr>
                <th className="px-4 py-2.5">Member</th><th className="px-4 py-2.5 text-right">Allowance</th>
                <th className="px-4 py-2.5 text-right">Used</th><th className="px-4 py-2.5 text-right">Remaining</th>
                <th className="w-40 px-4 py-2.5">Utilization</th>
              </tr>
            </thead>
            <tbody>
              {visibleCapacity.map((row) => {
                const overLimit =
                  row.remaining !== null && row.bookedHectareDays > row.limitHectareDays!;
                return (
                  <tr key={row.userId} className="border-t border-[#dde2dc] text-sm">
                    <td className="px-4 py-3 font-semibold text-[#173b31]">{row.name}</td>
                    <td className="px-4 py-3 text-right font-mono text-[#53615b]">
                      {row.limitHectareDays === null ? "Not set" : row.limitHectareDays.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[#53615b]">{row.bookedHectareDays.toFixed(1)}</td>
                    <td className={`px-4 py-3 text-right font-mono font-bold ${overLimit ? "text-[#b44b3e]" : "text-[#356859]"}`}>
                      {row.remaining === null ? "-" : row.remaining.toFixed(1)}
                    </td>
                    <td className="px-4 py-3">
                      {row.utilizationPercent === null ? (
                        <span className="text-xs text-[#7a857f]">Farm size needed</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 bg-[#e3e7e0]">
                            <div
                              className={`h-full ${overLimit ? "bg-[#b44b3e]" : "bg-[#356859]"}`}
                              style={{ width: `${row.utilizationPercent}%` }}
                            />
                          </div>
                          <span className="w-9 text-right font-mono text-xs text-[#65736d]">
                            {row.utilizationPercent}%
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  function renderContent() {
    if (!data) {
      return (
        <div className="grid min-h-64 place-items-center border-y border-[#d6dcd5] text-[#65736d]">
          <div className="flex items-center gap-2 text-sm font-semibold"><Loader2 className="h-4 w-4 animate-spin" />Loading seasons</div>
        </div>
      );
    }
    if (data.empty) {
      return (
        <div className="grid min-h-72 place-items-center border-y border-[#d6dcd5] bg-[#fffefa] px-6 text-center">
          <div className="max-w-md">
            <Wheat className="mx-auto mb-4 h-9 w-9 text-[#c0934d]" />
            <h3 className="font-['Barlow_Condensed',sans-serif] text-2xl font-bold text-[#173b31]">Set up the harvest calendar</h3>
            <p className="mt-2 text-sm leading-6 text-[#65736d]">Start with the cooperative&apos;s wet and dry seasons, then adjust their dates as needed.</p>
            <button
              type="button"
              onClick={() => void createDefaults()}
              disabled={busy === "bootstrap"}
              className="mt-5 inline-flex h-10 items-center justify-center gap-2 bg-[#173b31] px-5 text-sm font-bold text-white transition hover:bg-[#245444] disabled:opacity-60"
            >
              {busy === "bootstrap" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wheat className="h-4 w-4" />}
              Use wet and dry seasons
            </button>
          </div>
        </div>
      );
    }
    return (
      <>
        <div className="grid border-y border-[#c9d0c9] bg-[#fffefa] md:grid-cols-[1fr_280px]">
          <div className="border-b border-[#c9d0c9] p-4 md:border-b-0 md:border-r md:p-5">
            <p className="text-[10px] font-bold uppercase text-[#65736d]">Current season</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="font-['Barlow_Condensed',sans-serif] text-2xl font-bold text-[#173b31]">{data.current?.name ?? "Not available"}</p>
              {data.current ? <p className="font-mono text-xs text-[#65736d]">{formatPeriod(data.current.start, data.current.end)}</p> : null}
            </div>
          </div>
          <div className="p-4 md:p-5">
            <p className="text-[10px] font-bold uppercase text-[#65736d]">Next change</p>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <p className="text-sm font-bold text-[#173b31]">{data.next?.name ?? "Not available"}</p>
              {data.next ? <p className="font-mono text-xs text-[#65736d]">{formatIsoDate(data.next.start)} ({daysUntil(data.next.start)}d)</p> : null}
            </div>
          </div>
        </div>
        <div className="py-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase text-[#65736d]">Annual season map</p>
            <p className="text-[10px] text-[#7a857f]">Jan - Dec</p>
          </div>
          <div className="flex h-11 overflow-hidden border border-[#c9d0c9] bg-[#eef1e9]">
            {yearSegments.map((segment) => {
              const index = sortedSeasons.findIndex((item) => item.id === segment.season.id);
              const color =
                editor?.mode === "edit" && editor.id === segment.season.id
                  ? editor.color
                  : seasonColor(segment.season, index);
              return (
                <div
                  key={`${segment.season.id}-${segment.start}`}
                  className="flex min-w-0 items-center justify-center border-r border-white/35 px-2 text-center text-xs font-bold last:border-r-0"
                  style={{
                    width: `${(segment.days / 365) * 100}%`,
                    backgroundColor: color,
                    color: colorText(color),
                  }}
                  title={`${segment.season.name}: ${segment.days} days in this calendar year`}
                >
                {segment.days >= 35 ? (
                  <span className="min-w-0 truncate">
                    <span className="hidden sm:inline">{segment.season.name}</span>
                    <span className="sm:hidden">{segment.season.name.split(" ")[0]}</span>
                  </span>
                ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-1 grid grid-cols-12">
            {MONTH_SHORT.map((month) => (
              <span key={month} className="text-center font-mono text-[9px] text-[#7a857f]">
                <span className="hidden sm:inline">{month}</span>
                <span className="sm:hidden">{month.slice(0, 1)}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#c9d0c9]">
          <div className="flex" role="tablist" aria-label="Season management views">
            <button
              type="button" role="tab" aria-selected={view === "schedule"} onClick={() => setView("schedule")}
              className={`border-b-2 px-4 py-3 text-sm font-bold transition ${view === "schedule" ? "border-[#173b31] text-[#173b31]" : "border-transparent text-[#718079] hover:text-[#173b31]"}`}
            >Schedule</button>
            <button
              type="button" role="tab" aria-selected={view === "usage"} onClick={() => setView("usage")}
              className={`border-b-2 px-4 py-3 text-sm font-bold transition ${view === "usage" ? "border-[#173b31] text-[#173b31]" : "border-transparent text-[#718079] hover:text-[#173b31]"}`}
            >Member usage</button>
          </div>
          {view === "schedule" ? (
            <button type="button" onClick={openCreate} className="mb-2 mr-1 inline-flex h-9 items-center gap-2 bg-[#173b31] px-3 text-sm font-bold text-white transition hover:bg-[#245444]">
              <Plus className="h-4 w-4" />Add season
            </button>
          ) : null}
        </div>
        {view === "schedule" ? renderSchedule() : renderUsage()}
      </>
    );
  }

  return (
    <section className="animate-in fade-in duration-300">
      <div className="mb-5 flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center bg-[#d7e2b0] text-[#173b31]"><CalendarDays className="h-5 w-5" /></div>
        <div>
          <h2 className="font-['Barlow_Condensed',sans-serif] text-2xl font-bold text-[#173b31]">Harvest seasons</h2>
          <p className="mt-0.5 text-sm text-[#65736d]">Manage the yearly machine booking calendar.</p>
        </div>
      </div>
      {notice ? (
        <div className={`mb-4 flex items-start justify-between gap-3 border px-4 py-3 text-sm ${notice.type === "success" ? "border-[#a9bd84] bg-[#eef5db] text-[#29483e]" : "border-[#d9a49c] bg-[#fff1ed] text-[#8f3028]"}`}>
          <div className="flex items-center gap-2">
            {notice.type === "success" ? <Check className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            <span>{notice.text}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="grid h-5 w-5 shrink-0 place-items-center" aria-label="Dismiss message" title="Dismiss"><X className="h-4 w-4" /></button>
        </div>
      ) : null}
      {renderContent()}
      {deleteTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#102a23]/55 p-4" role="presentation">
          <div className="w-full max-w-sm border border-[#c9d0c9] bg-[#fffefa] p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="remove-season-title">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center bg-[#f4ddd7] text-[#9d352b]"><Trash2 className="h-5 w-5" /></div>
              <div>
                <h3 id="remove-season-title" className="font-['Barlow_Condensed',sans-serif] text-xl font-bold text-[#173b31]">Remove {deleteTarget.name}?</h3>
                <p className="mt-1 text-sm leading-6 text-[#65736d]">Its dates will become part of the preceding season. Existing booking records are kept.</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={busy === "delete"} className="h-10 border border-[#b9c5b9] px-4 text-sm font-bold text-[#53615b] transition hover:bg-[#eef1e9] disabled:opacity-60">Cancel</button>
              <button type="button" onClick={() => void removeSeason()} disabled={busy === "delete"} className="inline-flex h-10 items-center gap-2 bg-[#a43c32] px-4 text-sm font-bold text-white transition hover:bg-[#8f3028] disabled:opacity-60">
                {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
