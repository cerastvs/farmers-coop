"use client";

import { useEffect } from "react";

const ALERT_SEEN_KEYS = {
  rejectedLoans: "fc:seen:rejectedLoans",
  supplyAlerts: "fc:seen:supplyAlerts",
  machineAlerts: "fc:seen:machineAlerts",
} as const;

export type AlertCategory = keyof typeof ALERT_SEEN_KEYS;

function readSeen(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function unseenAlertIds(category: AlertCategory, ids: string[]): string[] {
  const seen = readSeen(ALERT_SEEN_KEYS[category]);
  return ids.filter((id) => !seen.has(id));
}

export function markAlertsSeen(category: AlertCategory, ids: string[]) {
  if (typeof window === "undefined" || ids.length === 0) return;
  const key = ALERT_SEEN_KEYS[category];
  const seen = readSeen(key);
  for (const id of ids) seen.add(id);
  try {
    window.localStorage.setItem(key, JSON.stringify([...seen]));
  } catch {
    // ignore storage errors
  }
}

export function useMarkAlertSeen(category: AlertCategory) {
  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const ids =
          category === "rejectedLoans"
            ? data.rejectedLoanIds
            : category === "supplyAlerts"
              ? data.supplyRequestIds
              : data.machineRequestIds;
        if (Array.isArray(ids)) markAlertsSeen(category, ids);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [category]);
}