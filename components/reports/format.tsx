"use client";

import type { ReactNode } from "react";
import { Money } from "@/components/Money";

export function humanize(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function renderValue(v: unknown): string | number {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export function money(v: unknown): ReactNode {
  const num = Number(v);
  return Number.isFinite(num) ? <Money value={num} /> : "—";
}

export function renderDate(v: unknown): string {
  if (!v) return "—";
  try {
    return new Date(v as string).toLocaleDateString("en-PH");
  } catch {
    return "—";
  }
}

export function renderDateTime(v: unknown): string {
  if (!v) return "—";
  try {
    return new Date(v as string).toLocaleString("en-PH");
  } catch {
    return "—";
  }
}

export function dateValue(v: unknown): number {
  if (!v) return -Infinity;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? -Infinity : d.getTime();
}

export function moneyValue(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export interface Cell {
  v: string | number;
  n: ReactNode;
}

export function cell(raw: unknown, node?: ReactNode): Cell {
  return {
    v: (raw as string | number) ?? "",
    n: node ?? renderValue(raw),
  };
}

export function formatReportPeriod(
  from: string | null | undefined,
  to: string | null | undefined,
): string {
  if (!from && !to) return "All time";
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