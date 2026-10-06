"use client";

import { useEffect, useRef } from "react";

type PollingOptions = {
  enabled?: boolean;
  runImmediately?: boolean;
};

/** Poll only while visible and prevent overlapping requests. */
export function usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  { enabled = true, runImmediately = false }: PollingOptions = {},
) {
  const callbackRef = useRef(callback);
  const runningRef = useRef(false);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const run = async () => {
      if (cancelled || document.visibilityState !== "visible" || runningRef.current) return;
      runningRef.current = true;
      try {
        await callbackRef.current();
      } finally {
        runningRef.current = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void run();
    };
    const intervalId = window.setInterval(run, intervalMs);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);
    if (runImmediately) void run();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [enabled, intervalMs, runImmediately]);
}
