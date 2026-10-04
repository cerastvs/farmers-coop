import React from "react";

interface QuickActionButtonProps {
  label: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  href: string;
  dot?: boolean;
}

export function QuickActionButton({
  label,
  icon,
  iconBg,
  iconColor,
  href,
  dot = false,
}: QuickActionButtonProps) {
  return (
    <a
      href={href}
      className="group relative flex min-h-28 flex-col items-start justify-between gap-3 border border-[#ccd4c8] bg-white p-4 transition hover:border-[#416747] hover:bg-[#e7efdf]"
    >
      {dot && (
        <span className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-red-100" />
      )}
      <div className={`${iconBg} ${iconColor} p-2`}>{icon}</div>
      <span className="text-left text-sm font-bold leading-tight text-[#173b31]">
        {label}
      </span>
    </a>
  );
}
