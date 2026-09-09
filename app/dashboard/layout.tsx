"use client";

import { useEffect } from "react";
import { useUser } from "../hooks/useUser";
import { fetchWithTimeout } from "./hooks/fetchWithTimeout";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setUser } = useUser();

  useEffect(() => {
    let cancelled = false;
    fetchWithTimeout("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !cancelled) setUser(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [setUser]);

  return <>{children}</>;
}