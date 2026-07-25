"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { logout } from "../../login/actions";
import { IconMenu, IconLeaf } from "@/components/icons";
import { Bell } from "lucide-react";

export function DashboardHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setUnreadCount(data.filter((n: { read: boolean }) => !n.read).length);
        }
      })
      .catch(() => {});
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => setUserRole(data.role ?? null))
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#174b36] text-white shadow-lg shadow-[#173a2b]/10">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#d6ed9f] text-[#174b36]"><IconLeaf className="h-4 w-4" /></span>
          <span className="font-extrabold tracking-tight">FarmCoop</span>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/dashboard/notifications"
            className="relative rounded-lg p-2 transition-colors hover:bg-white/15"
            aria-label="Notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg p-2 transition-colors hover:bg-white/15"
            aria-label="Menu"
          >
            <IconMenu />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="absolute right-4 top-[4.25rem] z-50 w-52 rounded-2xl border border-[#dfe7dc] bg-white py-2 shadow-2xl shadow-[#173a2b]/15">
          <Link
            href="/registration"
            onClick={() => setMenuOpen(false)}
            className="block w-full px-4 py-3 text-left text-sm font-semibold text-[#315646] transition-colors hover:bg-[#f0f7eb]"
          >
            Edit Profile
          </Link>
          {["PRESIDENT", "TREASURER", "SECRETARY"].includes(userRole ?? "") && (
            <Link
              href="/admin"
              onClick={() => setMenuOpen(false)}
              className="block w-full px-4 py-3 text-left text-sm font-semibold text-[#315646] transition-colors hover:bg-[#f0f7eb]"
            >
              Administration
            </Link>
          )}
          {userRole === "SECRETARY" && (
            <Link
              href="/dashboard/secretary"
              onClick={() => setMenuOpen(false)}
              className="block w-full px-4 py-3 text-left text-sm font-semibold text-[#315646] transition-colors hover:bg-[#f0f7eb]"
            >
              Membership Applications
            </Link>
          )}
          <form action={logout}>
            <button
              type="submit"
              className="w-full border-t border-[#edf0eb] px-4 py-3 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
            >
              Logout
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
