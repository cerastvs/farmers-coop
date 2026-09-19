"use client";

import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { getCatalog } from "./catalog";
import { formatReportPeriod, humanize } from "./format";
import type {
  ColumnDef,
  GroupField,
  ReportConfig,
  ReportData,
  Row,
  SectionDef,
  SortConfig,
} from "./types";

const COOP_NAME = "Farmers' Cooperative";

function readConfig(data: ReportData | null): ReportConfig | null {
  if (!data) return null;
  const raw = data.__config;
  if (raw && typeof raw === "object" && Array.isArray((raw as ReportConfig).sections)) {
    return raw as ReportConfig;
  }
  return null;
}

function sortRows(rows: Row[], sort: SortConfig | null, columns: ColumnDef[]): Row[] {
  if (!sort) return rows;
  const col = columns.find((c) => c.id === sort.field);
  if (!col) return rows;
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = col.get(a);
    const bv = col.get(b);
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return (
      String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true }) * dir
    );
  });
}

function numericValue(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function DataTable({
  columns,
  rows,
  groupBy,
  groupFields,
  sort,
  totalColumns,
}: {
  columns: ColumnDef[];
  rows: Row[];
  groupBy: string | null;
  groupFields: GroupField[];
  sort: SortConfig | null;
  totalColumns?: string[];
}) {
  const groups = useMemo<[string, Row[]][] | null>(() => {
    if (!groupBy) return null;
    const gf = groupFields.find((g) => g.key === groupBy);
    if (!gf) return null;
    const map = new Map<string, Row[]>();
    for (const row of rows) {
      const key = String(gf.get(row) ?? "Unspecified");
      const list = map.get(key);
      if (list) list.push(row);
      else map.set(key, [row]);
    }
    return [...map.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], undefined, { numeric: true }),
    );
  }, [rows, groupBy, groupFields]);

  const sorted = useMemo(() => sortRows(rows, sort, columns), [rows, sort, columns]);

  const totalRow = useMemo<ReactNode | null>(() => {
    if (!totalColumns || totalColumns.length === 0 || sorted.length === 0) return null;
    const sums = new Map<string, number>();
    for (const id of totalColumns) {
      const col = columns.find((c) => c.id === id);
      if (!col) continue;
      sums.set(id, sorted.reduce((acc, row) => acc + numericValue(col.get(row)), 0));
    }
    return (
      <tfoot>
        <tr className="rpt-total-row">
          {columns.map((col, i) => (
            <td key={col.id} className={`rpt-td${col.money ? " rpt-num" : ""}`}>
              {i === 0
                ? "Total"
                : sums.has(col.id)
                  ? col.money
                    ? `₱${sums.get(col.id)!.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : sums.get(col.id)!.toLocaleString("en-PH")
                  : ""}
            </td>
          ))}
        </tr>
      </tfoot>
    );
  }, [sorted, totalColumns, columns]);

  function tableFor(rowsToRender: Row[], keyPrefix: string) {
    if (rowsToRender.length === 0) {
      return <p className="rpt-empty">No records.</p>;
    }
    return (
      <table className="rpt-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.id} className={col.money ? "rpt-num" : undefined}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowsToRender.map((row, i) => (
            <tr key={`${keyPrefix}-${i}`}>
              {columns.map((col) => (
                <td key={col.id} className={col.money ? "rpt-num" : undefined}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {keyPrefix === "all" ? totalRow : null}
      </table>
    );
  }

  if (groups) {
    return (
      <div className="rpt-groups">
        {groups.map(([key, groupRows]) => (
          <div className="rpt-group" key={key}>
            <div className="rpt-group-head">
              {humanize(key)} — {groupRows.length}{" "}
              {groupRows.length === 1 ? "record" : "records"}
            </div>
            {tableFor(groupRows, key)}
          </div>
        ))}
      </div>
    );
  }

  return tableFor(sorted, "all");
}

function StatusBlock({
  groups,
}: {
  groups: { label: string; byStatus: Record<string, number> }[];
}) {
  const nonEmpty = groups.filter((g) => Object.keys(g.byStatus).length > 0);
  if (nonEmpty.length === 0) return null;
  return (
    <div className="rpt-status">
      {nonEmpty.map((group) => (
        <div className="rpt-status-line" key={group.label}>
          <span className="rpt-status-name">{group.label}</span>
          {Object.entries(group.byStatus).map(([status, count]) => (
            <span className="rpt-met" key={status}>
              <b className="rpt-met-num">{count}</b> {humanize(status)}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function SectionView({
  section,
  data,
  config,
}: {
  section: SectionDef;
  data: ReportData;
  config: ReportConfig | null;
}) {
  if (section.hideWhenEmpty?.(data)) return null;

  const sort = config?.sort ?? null;
  const groupBy = config?.groupBy ?? null;

  if (section.kind === "kv") {
    const items = (section.kvs ?? []).filter((k) => {
      const v = k.value(data);
      return v !== null && v !== undefined;
    });
    if (items.length === 0) return null;
    return (
      <div className="rpt-metrics">
        {items.map((k) => (
          <span className="rpt-met" key={k.id}>
            <span className="rpt-met-label">{k.label}</span>
            <span className="rpt-met-value">{k.value(data)}</span>
          </span>
        ))}
      </div>
    );
  }

  if (section.kind === "units") {
    const items = section.units ?? [];
    if (items.length === 0) return null;
    return (
      <div className="rpt-metrics">
        {items.map((u) => (
          <span className="rpt-met" key={u.id}>
            <span className="rpt-met-label">{u.label}</span>
            <span className="rpt-met-value">{u.primary(data)}</span>
            <span className="rpt-met-sub">{u.secondary(data)}</span>
          </span>
        ))}
      </div>
    );
  }

  if (section.kind === "stat") {
    return (
      <StatusBlock
        groups={(section.stats ?? []).map((s) => ({
          label: s.label,
          byStatus: s.byStatus(data),
        }))}
      />
    );
  }

  if (section.kind === "machineList") {
    const blocks = section.machines?.(data) ?? [];
    if (blocks.length === 0) return <p className="rpt-empty">No machines.</p>;
    return (
      <div className="rpt-machine-list">
        {blocks.map((block) => (
          <div className="rpt-machine" key={block.id}>
            <div className="rpt-machine-head">
              <span className="rpt-machine-name">{block.name}</span>
              {block.description ? (
                <span className="rpt-machine-desc">{block.description}</span>
              ) : null}
            </div>
            {block.requests.length > 0 ? (
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Status</th>
                    <th>Start</th>
                    <th>End</th>
                  </tr>
                </thead>
                <tbody>
                  {block.requests.map((r, i) => (
                    <tr key={i}>
                      <td>
                                {(() => {
                                  const n = (r.user as Record<string, unknown> | undefined)?.name;
                                  return typeof n === "string" ? n : "—";
                                })()}
                              </td>
                      <td>{humanize(r.status)}</td>
                      <td>
                        {r.startDate
                          ? new Date(r.startDate as string).toLocaleDateString("en-PH")
                          : "—"}
                      </td>
                      <td>
                        {r.endDate
                          ? new Date(r.endDate as string).toLocaleDateString("en-PH")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="rpt-empty">No requests.</p>
            )}
          </div>
        ))}
      </div>
    );
  }

  // table
  if (!section.table) return null;
  const allColumns = section.table.columns;
  const selectedIds = config?.columns?.[section.id];
  const columns =
    selectedIds && selectedIds.length > 0
      ? allColumns.filter((c) => selectedIds.includes(c.id))
      : allColumns;
  if (columns.length === 0) return null;
  const rows = section.table.rows(data);
  return (
    <DataTable
      columns={columns}
      rows={rows}
      groupBy={groupBy}
      groupFields={section.table.groupFields}
      sort={sort}
      totalColumns={section.table.totalColumns}
    />
  );
}

export interface ReportDocumentProps {
  type: string;
  data: ReportData | null;
  title: string;
  from?: string | null;
  to?: string | null;
  reportId?: string;
  generatedAt?: string | null;
  generatedByName?: string | null;
  memberName?: string | null;
  statuses?: string[];
  isPreview?: boolean;
}

export function ReportDocument({
  type,
  data,
  title,
  from,
  to,
  reportId,
  generatedAt,
  generatedByName,
  memberName,
  statuses,
  isPreview,
}: ReportDocumentProps) {
  const catalog = getCatalog(type);
  const config = readConfig(data);

  const sections = useMemo<SectionDef[]>(() => {
    if (!catalog) return [];
    const ids = config?.sections ?? catalog.defaultSections;
    const map = new Map(catalog.sections.map((s) => [s.id, s]));
    return ids.map((id) => map.get(id)).filter((s): s is SectionDef => Boolean(s));
  }, [catalog, config]);

  const recordCount = useMemo(() => {
    if (!data || !catalog) return 0;
    let total = 0;
    for (const section of sections) {
      if (section.kind === "table" && section.table) {
        total += section.table.rows(data).length;
      } else if (section.kind === "machineList") {
        total += (section.machines?.(data) ?? []).reduce(
          (sum, block) => sum + block.requests.length,
          0,
        );
      }
    }
    return total;
  }, [data, catalog, sections]);

  const period = formatReportPeriod(from, to);

  const filterParts: string[] = [];
  if (from || to) filterParts.push(period);
  if (memberName) filterParts.push(`Member: ${memberName}`);
  if (statuses && statuses.length > 0) filterParts.push(`Statuses: ${statuses.join(", ")}`);

  const generatedLabel = generatedAt
    ? new Date(generatedAt).toLocaleString("en-PH")
    : new Date().toLocaleString("en-PH");

  return (
    <article className="rpt-doc">
      <header className="rpt-header">
        <div className="rpt-brand">
          <div className="rpt-brand-mark" aria-hidden="true">
            FC
          </div>
          <div>
            <p className="rpt-coop">{COOP_NAME}</p>
            <p className="rpt-coop-sub">Official Report</p>
          </div>
        </div>
        <div className="rpt-heading">
          <h1 className="rpt-title">{title}</h1>
          <p className="rpt-subtitle">
            {catalog?.label ?? `${type} Report`}
            {isPreview ? " · Preview" : ""}
          </p>
        </div>
        <table className="rpt-meta">
          <tbody>
            <tr>
              <th>Period</th>
              <td>{period}</td>
              <th>Records</th>
              <td>{recordCount}</td>
            </tr>
            <tr>
              <th>Generated</th>
              <td>{generatedLabel}</td>
              <th>Report ID</th>
              <td>{reportId && reportId !== "preview" ? reportId.slice(0, 8).toUpperCase() : "—"}</td>
            </tr>
            {generatedByName ? (
              <tr>
                <th>Generated by</th>
                <td colSpan={3}>{generatedByName}</td>
              </tr>
            ) : null}
            {filterParts.length > 0 ? (
              <tr>
                <th>Filters</th>
                <td colSpan={3}>{filterParts.join(" · ")}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </header>

      <div className="rpt-body">
        {!data ? (
          <p className="rpt-empty">No report data.</p>
        ) : !catalog ? (
          <pre className="rpt-pre">{JSON.stringify(data, null, 2)}</pre>
        ) : sections.length === 0 ? (
          <p className="rpt-empty">
            No sections selected. Choose at least one section to include.
          </p>
        ) : (
          sections.map((section) => (
            <section className="rpt-section" key={section.id}>
              <h2 className="rpt-section-title">{section.label}</h2>
              <SectionView section={section} data={data} config={config} />
            </section>
          ))
        )}
      </div>

      {catalog && catalog.notes.length > 0 ? (
        <div className="rpt-notes">
          <p className="rpt-notes-title">Notes</p>
          <ul>
            {catalog.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <footer className="rpt-footer">
        <div className="rpt-sign">
          <span>Prepared by</span>
          <span className="rpt-sign-line" />
        </div>
        <div className="rpt-sign">
          <span>Reviewed by</span>
          <span className="rpt-sign-line" />
        </div>
        <div className="rpt-sign">
          <span>Date</span>
          <span className="rpt-sign-line" />
        </div>
      </footer>
      <div className="rpt-footer-note">
        {COOP_NAME} · Computer-generated report{isPreview ? " (preview)" : ""} ·{" "}
        {generatedAt ? new Date(generatedAt).toLocaleDateString("en-PH") : ""}
      </div>
    </article>
  );
}

const emptySubscribe = () => () => {};

export function ReportPrintCopy(props: ReportDocumentProps) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return createPortal(
    <div id="report-print-root" className="rpt-print-root">
      <ReportDocument {...props} />
    </div>,
    document.body,
  );
}