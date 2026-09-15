"use client";

/* eslint-disable @typescript-eslint/no-explicit-any -- Report data and rows
   are arbitrary JSON decoded from stored generator snapshots; the thorough
   typing of every possible report shape would be unreadable and brittle. */

import type { ReactNode } from "react";

export type ReportData = Record<string, any>;

export type ReportStatuses = string[];

export interface ReportFilters {
  from?: string;
  to?: string;
  memberId?: string;
  statuses?: string[];
}

export type SortDir = "asc" | "desc";

export interface SortConfig {
  field: string;
  dir: SortDir;
}

export type PresetId = "summary" | "detailed" | "full";

export const PRESET_IDS: PresetId[] = ["summary", "detailed", "full"];

export interface ReportConfig {
  version: 1;
  preset: PresetId;
  sections: string[];
  columns: Record<string, string[]>;
  sort: SortConfig | null;
  groupBy: string | null;
}

export type Row = Record<string, any>;

export type RowAccessor = (row: Row) => string | number | null;

export interface ColumnDef {
  id: string;
  label: string;
  get: RowAccessor;
  render: (row: Row) => ReactNode;
  money?: boolean;
}

export interface StatItemDef {
  id: string;
  label: string;
  value: (data: ReportData) => ReactNode;
}

export interface StatGroupDef {
  id: string;
  label: string;
  byStatus: (data: ReportData) => Record<string, number>;
}

export interface UnitsItemDef {
  id: string;
  label: string;
  primary: (data: ReportData) => string;
  secondary: (data: ReportData) => ReactNode;
}

export interface GroupField {
  key: string;
  label: string;
  get: RowAccessor;
}

export interface TableSectionDef {
  rows: (data: ReportData) => Row[];
  columns: ColumnDef[];
  groupFields: GroupField[];
  totalColumns?: string[];
}

export interface MachineBlock {
  id: string;
  name: string;
  description: string | null;
  requests: Row[];
}

export type SectionKind = "kv" | "units" | "stat" | "table" | "machineList";

export interface SectionDef {
  id: string;
  label: string;
  kind: SectionKind;
  kvs?: StatItemDef[];
  units?: UnitsItemDef[];
  stats?: StatGroupDef[];
  table?: TableSectionDef;
  machines?: (data: ReportData) => MachineBlock[];
  hideWhenEmpty?: (data: ReportData) => boolean;
}

export interface PresetDef {
  id: PresetId;
  label: string;
  sections: string[];
  columns?: Record<string, string[]>;
}

export interface ReportTypeCatalog {
  type: string;
  label: string;
  sections: SectionDef[];
  defaultSections: string[];
  presets: Record<PresetId, PresetDef>;
  statusOptions?: string[];
  memberFilter?: boolean;
  notes: string[];
}