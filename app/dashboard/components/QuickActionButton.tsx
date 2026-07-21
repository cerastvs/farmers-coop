import React from "react";

interface QuickActionButtonProps {
  label: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  href: string;
}

export function QuickActionButton({
  label,
  icon,
  iconBg,
  iconColor,
  href,
}: QuickActionButtonProps) {
  return (
    <a
      href={href}
      className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-[#e2e7dc] bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#bdd9a7] hover:shadow-md active:scale-95"
    >
      <div className={`${iconBg} ${iconColor} p-3 rounded-xl`}>{icon}</div>
      <span className="text-center text-xs font-bold leading-tight text-[#315646]">
        {label}
      </span>
    </a>
  );
}
