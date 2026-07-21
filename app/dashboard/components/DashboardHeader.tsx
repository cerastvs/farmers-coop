"use client";

import { useState } from "react";
import { logout } from "../../login/actions";
import { IconMenu, IconLeaf } from "@/components/icons";

export function DashboardHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#174b36] text-white shadow-lg shadow-[#173a2b]/10">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#d6ed9f] text-[#174b36]"><IconLeaf className="h-4 w-4" /></span>
          <span className="font-extrabold tracking-tight">FarmCoop</span>
        </div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-lg p-2 transition-colors hover:bg-white/15"
          aria-label="Menu"
        >
          <IconMenu />
        </button>
      </div>

      {menuOpen && (
        <div className="absolute right-4 top-[4.25rem] z-50 w-52 rounded-2xl border border-[#dfe7dc] bg-white py-2 shadow-2xl shadow-[#173a2b]/15">
          <a
            href="/registration"
            onClick={() => setMenuOpen(false)}
            className="block w-full px-4 py-3 text-left text-sm font-semibold text-[#315646] transition-colors hover:bg-[#f0f7eb]"
          >
            Edit Profile
          </a>
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
