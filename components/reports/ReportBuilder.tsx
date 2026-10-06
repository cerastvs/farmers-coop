"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  FileText,
  Layers,
  ListFilter,
  Printer,
  SlidersHorizontal,
  Square,
  X,
} from "lucide-react";
import {
  aggregateGroupOptions,
  aggregateSortFields,
  allColumnIds,
  getCatalog,
} from "./catalog";
import { ReportDocument, ReportPrintCopy } from "./ReportDocument";
import { MemberFilter } from "./MemberFilter";
import type {
  PresetId,
  ReportConfig,
  ReportFilters,
  SectionDef,
  SortDir,
} from "./types";

export interface ReportRecordLike {
  id: string;
  title: string;
  type: string;
  from?: string | null;
  to?: string | null;
  createdAt: string;
  data: Record<string, unknown> | null;
  generatedByName?: string | null;
}

interface ReportBuilderProps {
  reportTypes: string[];
  members: { id: string; name: string; username: string }[];
  busy: string | null;
  initialType?: string;
  initialFrom?: string;
  initialTo?: string;
  userName?: string | null;
  onGenerate: (req: {
    type: string;
    title?: string;
    filters: ReportFilters;
    config: ReportConfig;
  }) => Promise<ReportRecordLike | null>;
  onPreview: (req: {
    type: string;
    filters: ReportFilters;
    config: ReportConfig;
  }) => Promise<ReportRecordLike | null>;
  onClose: () => void;
}

function buildPresetColumns(
  sections: SectionDef[],
  presetSections: string[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const id of presetSections) {
    const section = sections.find((s) => s.id === id);
    if (section && section.table) out[id] = allColumnIds(section);
  }
  return out;
}

function todayISO(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export function ReportBuilder({
  reportTypes,
  members,
  busy,
  initialType = "SUMMARY",
  initialFrom,
  initialTo,
  userName,
  onGenerate,
  onPreview,
  onClose,
}: ReportBuilderProps) {
  const [type, setType] = useState(initialType);
  const [title, setTitle] = useState("");
  const [from, setFrom] = useState(initialFrom ?? todayISO());
  const [to, setTo] = useState(initialTo ?? todayISO());
  const [memberId, setMemberId] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);
  const [applicationStatuses, setApplicationStatuses] = useState<string[]>([]);
  const [preset, setPreset] = useState<PresetId>("detailed");
  const [sections, setSections] = useState<string[]>([]);
  const [columns, setColumns] = useState<Record<string, string[]>>({});
  const [sortField, setSortField] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [groupBy, setGroupBy] = useState("");
  const [live, setLive] = useState<ReportRecordLike | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [generated, setGenerated] = useState<ReportRecordLike | null>(null);
  const [openPanel, setOpenPanel] = useState<string | null>("filters");

  const catalog = getCatalog(type);

  useEffect(() => {
    if (!catalog) return;
    const presetSections = catalog.presets[preset].sections;
    setSections(presetSections);
    setColumns(buildPresetColumns(catalog.sections, presetSections));
    setSortField("");
    setGroupBy("");
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const config = useMemo<ReportConfig>(
    () => ({
      version: 1,
      preset,
      sections,
      columns,
      sort: sortField ? { field: sortField, dir: sortDir } : null,
      groupBy: groupBy || null,
    }),
    [preset, sections, columns, sortField, sortDir, groupBy],
  );

  const filters = useMemo<ReportFilters>(
    () => ({
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(memberId ? { memberId } : {}),
      ...(statuses.length > 0 ? { statuses } : {}),
      ...(applicationStatuses.length > 0 ? { applicationStatuses } : {}),
    }),
    [from, to, memberId, statuses, applicationStatuses],
  );

  useEffect(() => {
    if (generated) return;
    const t = setTimeout(() => {
      if (!catalog) return;
      onPreview({ type, filters, config }).then((r) => {
        setLive(r);
        setPreviewError(!r);
      });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, from, to, memberId, statuses, applicationStatuses, sections, columns, sortField, sortDir, groupBy, onPreview]);

  const groupOptions = useMemo(
    () => (catalog ? aggregateGroupOptions(catalog) : []),
    [catalog],
  );
  const sortOptions = useMemo(
    () => (catalog ? aggregateSortFields(catalog) : []),
    [catalog],
  );

  function toggleSection(id: string) {
    setSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  function moveSection(id: string, dir: -1 | 1) {
    setSections((prev) => {
      const i = prev.indexOf(id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function applyPreset(id: PresetId) {
    if (!catalog) return;
    setPreset(id);
    const presetSections = catalog.presets[id].sections;
    setSections(presetSections);
    setColumns(buildPresetColumns(catalog.sections, presetSections));
    setSortField("");
    setGroupBy("");
  }

  function toggleColumn(sectionId: string, colId: string) {
    setColumns((prev) => {
      const current = prev[sectionId] ?? [];
      const next = current.includes(colId)
        ? current.filter((c) => c !== colId)
        : [...current, colId];
      return { ...prev, [sectionId]: next };
    });
  }

  function setSectionColumns(sectionId: string, ids: string[]) {
    setColumns((prev) => ({ ...prev, [sectionId]: ids }));
  }

  function selectedSection(id: string): SectionDef | undefined {
    return catalog?.sections.find((s) => s.id === id);
  }

  function generate() {
    onGenerate({
      type,
      title: title.trim() || undefined,
      filters,
      config,
    }).then((r) => {
      if (r) setGenerated(r);
    });
  }

  function toggleStatus(value: string) {
    setStatuses((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
    );
  }

  function toggleApplicationStatus(value: string) {
    setApplicationStatuses((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
    );
  }

  function panelButton(id: string, label: string, icon: ReactNode) {
    const open = openPanel === id;
    return (
      <button
        type="button"
        onClick={() => setOpenPanel(open ? null : id)}
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-bold transition ${
          open
            ? "border-indigo-300 bg-indigo-50 text-indigo-700"
            : "border-[#dce5d9] bg-white text-[#315646] hover:border-indigo-200 hover:bg-indigo-50/50"
        }`}
      >
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102a23]/65 p-3 backdrop-blur-sm sm:p-5">
      <div role="dialog" aria-modal="true" aria-labelledby="report-builder-title" className="flex max-h-[94vh] w-full max-w-[1440px] flex-col overflow-hidden rounded-xl border border-[#d5e1d8] bg-[#fbfdfb] shadow-[0_24px_80px_rgba(16,42,35,0.24)]">
        <div className="flex items-center justify-between gap-4 border-b border-[#e3ebe3] bg-white px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-700"><FileText size={17} /></div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-indigo-600">Report Builder</p>
                <span className="rounded-full bg-[#eef2ec] px-2 py-0.5 text-[10px] font-bold capitalize text-[#496558]">{type}</span>
              </div>
            <h3 id="report-builder-title" className="truncate text-sm font-black text-[#173a2b] sm:text-base">
              {generated ? generated.title : "Configure a printable report"}
            </h3>
            </div>
          </div>
          <button
            disabled={busy === "report"}
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg border border-transparent p-2 text-gray-400 transition hover:border-[#dce5d9] hover:bg-[#f7faf5] hover:text-[#173a2b]"
          >
            <X size={18} />
          </button>
        </div>

        {generated ? (
          <div className="overflow-y-auto bg-[#eef3ee] p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/90 px-3.5 py-2.5 text-xs font-bold text-emerald-800">
              <span className="inline-flex items-center gap-2"><CheckCircle2 size={14} /> Report generated successfully.</span>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white/60 px-2.5 py-1.5 text-[10px] font-bold text-emerald-800 transition hover:bg-emerald-100"
                >
                  <Printer size={12} /> Print
                </button>
                <button
                  onClick={onClose}
                  className="rounded-md border border-emerald-300 bg-white/60 px-2.5 py-1.5 text-[10px] font-bold text-emerald-800 transition hover:bg-emerald-100"
                >
                  Done
                </button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg shadow-sm">
              <ReportDocument
                type={type}
                data={generated.data}
                title={generated.title}
                from={generated.from}
                to={generated.to}
                reportId={generated.id}
                generatedAt={generated.createdAt}
                generatedByName={generated.generatedByName ?? userName}
                isPreview={false}
              />
            </div>
            <ReportPrintCopy
              type={type}
              data={generated.data}
              title={generated.title}
              from={generated.from}
              to={generated.to}
              reportId={generated.id}
              generatedAt={generated.createdAt}
              generatedByName={generated.generatedByName ?? userName}
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
            {/* ---------------- Controls ---------------- */}
            <div className="flex flex-col gap-3 overflow-y-auto border-b border-[#e3ebe3] bg-[#f7faf5] p-4 sm:p-5 md:w-[360px] md:border-b-0 md:border-r">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wide text-[#718176]">
                  Report type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full rounded-lg border border-[#dce5d9] bg-white px-2 py-1.5 text-xs font-semibold outline-none"
                >
                  {reportTypes.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Optional report title"
                  className="w-full rounded-lg border border-[#dce5d9] bg-white px-3 py-1.5 text-sm outline-none"
                />
              </div>

              {panelButton("filters", "Filters & Period", <ListFilter size={13} />)}
              {openPanel === "filters" && (
                <div className="space-y-2.5 rounded-lg border border-[#e6ece5] bg-white p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase tracking-wide text-[#718176]">
                        From
                      </label>
                      <input
                        type="date"
                        value={from}
                        onChange={(e) => {
                          const nextFrom = e.target.value;
                          setFrom(nextFrom);
                          if (to === from) setTo(nextFrom);
                        }}
                        className="rounded-lg border border-[#dce5d9] bg-white px-2 py-1.5 text-xs outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase tracking-wide text-[#718176]">
                        To
                      </label>
                      <input
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        className="rounded-lg border border-[#dce5d9] bg-white px-2 py-1.5 text-xs outline-none"
                      />
                    </div>
                  </div>
                  {catalog?.memberFilter && members.length > 0 && (
                    <MemberFilter
                      members={members}
                      value={memberId}
                      onChange={setMemberId}
                    />
                  )}
                  {catalog?.statusOptions ? (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wide text-[#718176]">
                        Status filters
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {catalog.statusOptions.map((s) => {
                          const selected = statuses.includes(s);
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => toggleStatus(s)}
                              className={`rounded-lg border px-2 py-1 text-[10px] font-bold transition ${
                                selected
                                  ? "border-indigo-400 bg-indigo-600 text-white"
                                  : "border-[#dce5d9] bg-white text-[#496558] hover:bg-indigo-50"
                              }`}
                            >
                              {humanizeShort(s)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  {catalog?.applicationStatusOptions ? (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wide text-[#718176]">
                        Application status
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {catalog.applicationStatusOptions.map((s) => {
                          const selected = applicationStatuses.includes(s);
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => toggleApplicationStatus(s)}
                              className={`rounded-lg border px-2 py-1 text-[10px] font-bold transition ${
                                selected
                                  ? "border-emerald-400 bg-emerald-700 text-white"
                                  : "border-[#dce5d9] bg-white text-[#496558] hover:bg-emerald-50"
                              }`}
                            >
                              {humanizeShort(s)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {panelButton("preset", "Preset", <Layers size={13} />)}
              {openPanel === "preset" && catalog && (
                <div className="grid grid-cols-3 gap-2 rounded-lg border border-[#e6ece5] bg-white p-3">
                  {(["summary", "detailed", "full"] as PresetId[]).map((id) => {
                    const p = catalog.presets[id];
                    const selected = preset === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => applyPreset(id)}
                        className={`rounded-lg border px-2 py-2 text-center text-[11px] font-bold transition ${
                          selected
                            ? "border-indigo-400 bg-indigo-600 text-white"
                            : "border-[#dce5d9] bg-white text-[#315646] hover:bg-indigo-50"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {panelButton("sections", "Sections", <Square size={13} />)}
              {openPanel === "sections" && catalog && (
                <div className="rounded-lg border border-[#e6ece5] bg-white p-3">
                  <p className="mb-2 text-[10px] font-semibold text-[#8fa594]">
                    Included sections ({sections.length}/{catalog.sections.length}) — use the
                    arrows to reorder.
                  </p>
                  <div className="space-y-1">
                    {catalog.sections.map((section) => {
                      const selected = sections.includes(section.id);
                      const idx = sections.indexOf(section.id);
                      return (
                        <div key={section.id} className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleSection(section.id)}
                            className={`flex flex-1 items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-[11px] font-semibold transition ${
                              selected
                                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                                : "border-[#e6ece5] bg-white text-[#8fa594]"
                            }`}
                          >
                            {selected ? (
                              <CheckSquare size={13} className="shrink-0" />
                            ) : (
                              <Square size={13} className="shrink-0" />
                            )}
                            <span className="truncate">{section.label}</span>
                          </button>
                          {selected && (
                            <>
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => moveSection(section.id, -1)}
                                aria-label="Move up"
                                className="rounded-lg border border-[#dce5d9] p-1.5 text-[#496558] hover:bg-indigo-50 disabled:opacity-30"
                              >
                                <ArrowUp size={12} />
                              </button>
                              <button
                                type="button"
                                disabled={idx === sections.length - 1}
                                onClick={() => moveSection(section.id, 1)}
                                aria-label="Move down"
                                className="rounded-lg border border-[#dce5d9] p-1.5 text-[#496558] hover:bg-indigo-50 disabled:opacity-30"
                              >
                                <ArrowDown size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {panelButton("columns", "Columns", <SlidersHorizontal size={13} />)}
              {openPanel === "columns" && catalog && (
                <div className="space-y-3 rounded-lg border border-[#e6ece5] bg-white p-3">
                  {sections
                    .map((id) => selectedSection(id))
                    .filter((s): s is SectionDef => Boolean(s?.table))
                    .map((section) => {
                      const all = allColumnIds(section);
                      const current = columns[section.id] ?? all;
                      return (
                        <div key={section.id}>
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <p className="text-[11px] font-bold text-[#315646]">
                              {section.label}
                            </p>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => setSectionColumns(section.id, all)}
                                className="rounded border border-[#dce5d9] px-1.5 py-0.5 text-[9px] font-bold text-[#496558] hover:bg-indigo-50"
                              >
                                All
                              </button>
                              <button
                                type="button"
                                onClick={() => setSectionColumns(section.id, [])}
                                className="rounded border border-[#dce5d9] px-1.5 py-0.5 text-[9px] font-bold text-[#496558] hover:bg-indigo-50"
                              >
                                Clear
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setSectionColumns(
                                    section.id,
                                    all.filter((id) => id !== "reason"),
                                  )
                                }
                                className="rounded border border-[#dce5d9] px-1.5 py-0.5 text-[9px] font-bold text-[#496558] hover:bg-indigo-50"
                              >
                                Defaults
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {section.table!.columns.map((col) => {
                              const selected = current.includes(col.id);
                              return (
                                <button
                                  key={col.id}
                                  type="button"
                                  onClick={() => toggleColumn(section.id, col.id)}
                                  className={`rounded-lg border px-2 py-1 text-[10px] font-bold transition ${
                                    selected
                                      ? "border-indigo-400 bg-indigo-600 text-white"
                                      : "border-[#dce5d9] bg-white text-[#496558] hover:bg-indigo-50"
                                  }`}
                                >
                                  {col.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  {!sections.some((id) => selectedSection(id)?.table) && (
                    <p className="text-[11px] font-semibold text-[#8fa594]">
                      Include a table section to choose columns.
                    </p>
                  )}
                </div>
              )}

              {panelButton("sort", "Sort & Group", <ArrowUp size={13} />)}
              {openPanel === "sort" && (
                <div className="space-y-2.5 rounded-lg border border-[#e6ece5] bg-white p-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-[#718176]">
                      Sort by
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={sortField}
                        onChange={(e) => setSortField(e.target.value)}
                        className="flex-1 rounded-lg border border-[#dce5d9] bg-white px-2 py-1.5 text-xs outline-none"
                      >
                        <option value="">None</option>
                        {sortOptions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      {sortField && (
                        <select
                          value={sortDir}
                          onChange={(e) => setSortDir(e.target.value as SortDir)}
                          className="rounded-lg border border-[#dce5d9] bg-white px-2 py-1.5 text-xs outline-none"
                        >
                          <option value="asc">Asc</option>
                          <option value="desc">Desc</option>
                        </select>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-[#718176]">
                      Group by
                    </label>
                    <select
                      value={groupBy}
                      onChange={(e) => setGroupBy(e.target.value)}
                      className="rounded-lg border border-[#dce5d9] bg-white px-2 py-1.5 text-xs outline-none"
                    >
                      <option value="">None</option>
                      {groupOptions.map((g) => (
                        <option key={g.key} value={g.key}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                    {groupBy && (
                      <p className="text-[10px] font-semibold text-[#8fa594]">
                        Groups are applied to tables that can be grouped by this field.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ---------------- Preview ---------------- */}
            <div className="flex-1 overflow-y-auto bg-[#edf3ee] p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#718176]">
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" />Live preview · {type} Report
                </p>
                {previewError && (
                  <p className="text-[10px] font-bold text-red-500">
                    Could not load preview.
                  </p>
                )}
              </div>
              <div className="overflow-x-auto rounded-lg shadow-sm">
                {live && live.data ? (
                  <ReportDocument
                    type={live.type}
                    data={live.data}
                    title={live.title}
                    from={live.from}
                    to={live.to}
                    reportId="preview"
                    generatedAt={live.createdAt}
                    generatedByName={userName}
                    isPreview
                  />
                ) : (
                  <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-[#c9d3cb] bg-white text-xs font-semibold text-[#8fa594]">
                    {busy === "report" ? "Loading preview…" : "Adjusting settings…"}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!generated && (
          <div className="border-t border-[#e3ebe3] bg-white px-4 py-3.5 sm:px-5">
            <button
              disabled={busy === "report" || sections.length === 0}
              onClick={generate}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileText size={14} />
              {busy === "report" ? "Generating…" : "Generate Report"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function humanizeShort(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}
