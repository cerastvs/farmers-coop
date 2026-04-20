"use client";

import { useState } from "react";
import { logout } from "../../login/actions";
import { IconMenu, IconLeaf } from "@/components/icons";

export function DashboardHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="bg-[#2d6a2d] text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconLeaf />
          <span className="font-bold text-base tracking-wide">FarmCoop</span>
        </div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1 rounded-lg hover:bg-white/20 transition-colors"
          aria-label="Menu"
        >
          <IconMenu />
        </button>
      </div>

      {menuOpen && (
        <div className="absolute right-4 top-14 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 w-48 z-50">
          <form action={logout}>
            <button
              type="submit"
              className="w-full text-left px-4 py-3 text-sm text-red-600 font-medium hover:bg-red-50 transition-colors"
            >
              Logout
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
