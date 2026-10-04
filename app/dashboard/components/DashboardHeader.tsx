"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "../../login/actions";
import { IconMenu } from "@/components/icons";
import { Bell } from "lucide-react";
import { useUser } from "../../hooks/useUser";

export function DashboardHeader() {
  const { user } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [guarantorRejected, setGuarantorRejected] = useState(false);
  const pathname = usePathname();

  const userRole = user?.role ?? null;
  const memberLinks = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/applyLoan", label: "Apply for a loan" },
    { href: "/dashboard/viewloan", label: "Your loans" },
    { href: "/dashboard/supplies", label: "Supplies" },
    { href: "/dashboard/rentMachine", label: "Machinery" },
  ];

  useEffect(() => {
    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setUnreadCount(data.filter((n: { read: boolean }) => !n.read).length);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (userRole === "APPLICANT" || userRole === "MEMBER") {
      fetch("/api/registration")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          setGuarantorRejected(data?.guarantorStatus === "REJECTED");
        })
        .catch(() => {});
    }
  }, [userRole]);

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#173b31] text-white">
      <div className="mx-auto flex h-17 max-w-[1180px] items-center justify-between gap-4 px-4">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center bg-[#d9e3cb] font-['Barlow_Condensed'] text-lg font-bold text-[#173b31]">FC</span>
          <span className="font-extrabold tracking-tight">FarmCoop</span>
        </Link>
        {userRole === "MEMBER" && (
          <nav aria-label="Member navigation" className="hidden items-center gap-1 lg:flex">
            {memberLinks.map((link) => (
              <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined} className={`px-3 py-2 text-xs font-bold transition hover:bg-white/10 ${pathname === link.href ? "bg-white/15 text-[#d9e3cb]" : "text-white/80"}`}>{link.label}</Link>
            ))}
          </nav>
        )}
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
        <div className="absolute right-4 top-[4.25rem] z-50 w-56 border border-[#dfe7dc] bg-white py-2 shadow-2xl shadow-[#173a2b]/15">
          {userRole === "MEMBER" && memberLinks.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm font-semibold text-[#315646] hover:bg-[#f0f7eb] lg:hidden">{link.label}</Link>
          ))}
          <Link
            href="/registration"
            onClick={() => setMenuOpen(false)}
            className="relative block w-full px-4 py-3 text-left text-sm font-semibold text-[#315646] transition-colors hover:bg-[#f0f7eb]"
          >
            <span className="inline-flex items-center gap-2">
              Edit Profile
              {guarantorRejected && (
                <span className="inline-block h-2 w-2 rounded-full bg-red-500 ring-2 ring-red-200" />
              )}
            </span>
          </Link>
          {userRole === "APPLICANT" && (
            <Link
              href="/dashboard/payment"
              onClick={() => setMenuOpen(false)}
              className="block w-full px-4 py-3 text-left text-sm font-semibold text-[#315646] transition-colors hover:bg-[#f0f7eb]"
            >
              Application Payment
            </Link>
          )}
          {userRole === "SECRETARY" && (
            <Link
              href="/dashboard/secretary"
              onClick={() => setMenuOpen(false)}
              className="block w-full px-4 py-3 text-left text-sm font-semibold text-[#315646] transition-colors hover:bg-[#f0f7eb]"
            >
              Secretary Dashboard
            </Link>
          )}
          {userRole === "PRESIDENT" && (
            <Link
              href="/dashboard/president"
              onClick={() => setMenuOpen(false)}
              className="block w-full px-4 py-3 text-left text-sm font-semibold text-[#315646] transition-colors hover:bg-[#f0f7eb]"
            >
              President Dashboard
            </Link>
          )}
          {userRole === "TREASURER" && (
            <Link
              href="/dashboard/treasurer"
              onClick={() => setMenuOpen(false)}
              className="block w-full px-4 py-3 text-left text-sm font-semibold text-[#315646] transition-colors hover:bg-[#f0f7eb]"
            >
              Treasurer Dashboard
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
