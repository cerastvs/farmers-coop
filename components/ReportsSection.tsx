"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ReportModal, ReportContent } from "@/components/ReportModal";

export interface ReportRecord {
  id: string;
  title: string;
  type: string;
  from: string | null;
  to: string | null;
  createdAt: string;
  data: Record<string, unknown> | null;
}

interface ReportFilters {
  from?: string;
  to?: string;
  memberId?: string;
  statuses?: string[];
}

interface ReportsSectionProps {
  items: ReportRecord[];
  onGenerate: (
    type: string,
    title?: string,
    filters?: ReportFilters,
  ) => Promise<ReportRecord | null>;
  onPreview: (
    type: string,
    filters?: ReportFilters,
  ) => Promise<ReportRecord | null>;
  busy: string | null;
  role?: string;
}

const FINANCIAL_REPORT_TYPES = [
  "SUMMARY",
  "LOANS",
  "PAYMENTS",
  "SUPPLIES",
];

const ALL_REPORT_TYPES = [
  "SUMMARY",
  "MEMBERS",
  "LOANS",
  "PAYMENTS",
  "SUPPLIES",
  "MACHINES",
  "AUDIT",
];

function formatReportDateRange(
  from: string | null,
  to: string | null,
): string | null {
  if (!from && !to) return null;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const yearOpts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  if (from && to) {
    const d1 = new Date(from);
    const d2 = new Date(to);
    if (d1.getFullYear() === d2.getFullYear()) {
      return `${d1.toLocaleDateString("en-US", opts)} – ${d2.toLocaleDateString("en-US", yearOpts)}`;
    }
    return `${d1.toLocaleDateString("en-US", yearOpts)} – ${d2.toLocaleDateString("en-US", yearOpts)}`;
  }
  if (from) return `From ${new Date(from).toLocaleDateString("en-US", yearOpts)}`;
  return `Until ${new Date(to!).toLocaleDateString("en-US", yearOpts)}`;
}

export default function ReportsSection({
  items,
  onGenerate,
  onPreview,
  busy,
  role,
}: ReportsSectionProps) {
  const REPORT_TYPES = useMemo(
    () =>
      role === "TREASURER" ? FINANCIAL_REPORT_TYPES : ALL_REPORT_TYPES,
    [role],
  );
  const [reportType, setReportType] = useState("SUMMARY");
  const [reportTitle, setReportTitle] = useState("");
  const [from, setFrom] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().slice(0, 10);
  });
  const [statuses, setStatuses] = useState("");
  const [viewReport, setViewReport] = useState<ReportRecord | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generated, setGenerated] = useState<ReportRecord | null>(null);
  const [liveReport, setLiveReport] = useState<ReportRecord | null>(null);

  function buildFilters() {
    const filters: { from?: string; to?: string; statuses?: string[] } = {};
    if (from) filters.from = from;
    if (to) filters.to = to;
    if (statuses.trim()) {
      filters.statuses = statuses
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
    }
    return filters;
  }

  useEffect(() => {
    if (!generatorOpen) return;
    const t = setTimeout(() => {
      onPreview(reportType, buildFilters()).then((r) => {
        if (r) setLiveReport(r);
      });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, from, to, statuses, generatorOpen, onPreview]);

  function closeGenerator() {
    setGeneratorOpen(false);
    setGenerated(null);
  }

  function generate() {
    onGenerate(reportType, reportTitle.trim() || undefined, buildFilters()).then(
      (r) => {
        setSuccessMessage(
          r ? "Report generated successfully." : "Failed to generate report.",
        );
        if (r) setGenerated(r);
      },
    );
    setReportTitle("");
    setStatuses("");
  }

  return (
    <div className="rounded-xl border border-[#e2ebe6] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2ebe6] px-5 py-4">
        <div>
          <h3 className="text-sm font-bold text-[#0f2318]" style={{ fontFamily: "var(--font-display)" }}>
            Reports &amp; Analytics
          </h3>
          <p className="text-[11px] text-[#5a7267]">
            {items.length} reports generated
          </p>
        </div>
        <button
          disabled={busy === "report"}
          onClick={() => setGeneratorOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          <span>Generate Report</span>
        </button>
      </div>

      <div className="space-y-2 p-4">
        {successMessage && (
          <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-bold text-green-700">
            {successMessage}
            <button
              onClick={() => setSuccessMessage(null)}
              className="rounded-lg border border-green-200 px-2 py-0.5 text-[10px] font-bold text-green-600 hover:bg-green-100"
            >
              Dismiss
            </button>
          </div>
        )}
        {items.length > 0 ? (
          items.map((report) => (
            <button
              key={report.id}
              onClick={() => setViewReport(report)}
              className="flex w-full items-center justify-between rounded-xl border border-[#eef2e8] bg-[#fafdf7] px-4 py-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#173a2b]">
                  {report.title}
                </p>
                <p className="text-xs text-[#718176]">
                  {report.type} · {new Date(report.createdAt).toLocaleDateString()}
                </p>
                {formatReportDateRange(report.from, report.to) && (
                  <p className="mt-0.5 text-[11px] font-semibold text-indigo-600">
                    {formatReportDateRange(report.from, report.to)}
                  </p>
                )}
              </div>
              <span className="ml-3 shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1 text-[10px] font-bold text-white">
                View
              </span>
            </button>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-[#d5ddd0] bg-[#fafdf7] p-6 text-center text-xs text-[#718176]">
            No reports generated yet
          </div>
        )}
      </div>

      {createPortal(
        <>
          {viewReport && (
            <ReportModal report={viewReport} onClose={() => setViewReport(null)} />
          )}
          {generatorOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
              onClick={() => {
                if (busy !== "report") closeGenerator();
              }}
            >
              <div
                className="w-full max-w-2xl rounded-2xl border border-[#dce5d9] bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-[#eef2e8] bg-[#f7faf5] px-5 py-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">
                      Generate Report
                    </p>
                    <h3 className="text-sm font-black text-[#173a2b]">
                      {generated ? generated.title : "Report generation"}
                    </h3>
                  </div>
                  <button
                    disabled={busy === "report"}
                    onClick={closeGenerator}
                    aria-label="Close"
                    className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    <X size={18} />
                  </button>
                </div>
                {generated ? (
                  <div className="p-5">
                    <div className="mb-3 flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-bold text-green-700">
                      Report generated successfully.
                      <button
                        onClick={closeGenerator}
                        className="rounded-lg border border-green-200 px-2 py-0.5 text-[10px] font-bold text-green-600 hover:bg-green-100"
                      >
                        Done
                      </button>
                    </div>
                    {generated.from || generated.to ? (
                      <p className="mb-1 text-[11px] font-semibold text-indigo-600">
                        {formatReportDateRange(generated.from, generated.to)}
                      </p>
                    ) : null}
                    <p className="mb-3 text-xs text-[#718176]">
                      {generated.type} Report · Generated{" "}
                      {new Date(generated.createdAt).toLocaleString("en-PH")}
                    </p>
                    <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-[#eef2e8] bg-[#fafdf7] p-4">
                      <ReportContent
                        type={generated.type}
                        data={generated.data ?? {}}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex max-h-[80vh] flex-col">
                    <div className="space-y-3 p-5">
                      <div className="flex gap-2">
                        <select
                          value={reportType}
                          onChange={(e) => setReportType(e.target.value)}
                          className="rounded-lg border border-[#dce5d9] bg-white px-2 py-1.5 text-xs font-semibold outline-none"
                        >
                          {REPORT_TYPES.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                        <input
                          value={reportTitle}
                          onChange={(e) => setReportTitle(e.target.value)}
                          placeholder="Optional title"
                          className="flex-1 rounded-lg border border-[#dce5d9] bg-white px-3 py-1.5 text-sm outline-none"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <input
                          type="date"
                          value={from}
                          onChange={(e) => setFrom(e.target.value)}
                          title="From date"
                          className="rounded-lg border border-[#dce5d9] bg-white px-2 py-1.5 text-xs outline-none"
                        />
                        <input
                          type="date"
                          value={to}
                          onChange={(e) => setTo(e.target.value)}
                          title="To date"
                          className="rounded-lg border border-[#dce5d9] bg-white px-2 py-1.5 text-xs outline-none"
                        />
                        <input
                          value={statuses}
                          onChange={(e) => setStatuses(e.target.value)}
                          placeholder="Status filters, e.g. ACTIVE, OVERDUE"
                          className="min-w-[180px] flex-1 rounded-lg border border-[#dce5d9] bg-white px-3 py-1.5 text-xs outline-none"
                        />
                      </div>
                    </div>
                    {liveReport && liveReport.data ? (
                      <div className="mx-5 mb-5 rounded-xl border border-indigo-200 bg-[#fafdf7] p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-600">
                            Preview · {liveReport.type} Report
                          </p>
                          <button
                            onClick={() => setLiveReport(null)}
                            className="text-[10px] font-bold text-gray-500 hover:text-gray-700"
                          >
                            Hide
                          </button>
                        </div>
                        <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-[#eef2e8] bg-white p-3">
                          <ReportContent
                            type={liveReport.type}
                            data={liveReport.data}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="mx-5 mb-5 text-[11px] font-semibold text-[#8fa594]">
                        Preview will appear here while you adjust the report
                        settings.
                      </p>
                    )}
                    <div className="border-t border-[#eef2e8] bg-[#f7faf5] px-5 py-3">
                      <button
                        disabled={busy === "report"}
                        onClick={generate}
                        className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {busy === "report" ? "Generating…" : "Generate Report"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>,
        document.body,
      )}
    </div>
  );
}