"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUser } from "../hooks/useUser";
import { fetchWithTimeout } from "./hooks/fetchWithTimeout";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setUser } = useUser();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetchWithTimeout("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || cancelled) return;
        // A disabled account keeps its session but loses every API call, so
        // send it to the notice page instead of a dashboard it cannot use.
        // The check is a live read rather than a session flag, so deactivating
        // someone takes effect on their next navigation, not at token expiry.
        if (data.active === false) {
          router.replace("/account-disabled");
          return;
        }
        setUser(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [setUser, router]);

  return <>{children}</>;
}