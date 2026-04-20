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
      className="flex flex-col items-center justify-center gap-2 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all active:scale-95"
    >
      <div className={`${iconBg} ${iconColor} p-3 rounded-xl`}>{icon}</div>
      <span className="text-xs font-semibold text-gray-700 text-center leading-tight">
        {label}
      </span>
    </a>
  );
}
