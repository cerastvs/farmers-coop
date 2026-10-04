import React from "react";

interface SummaryCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  largeValue?: boolean;
}

export function SummaryCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  largeValue,
}: SummaryCardProps) {
  return (
    <div className="flex min-h-32 items-start justify-between border-t-2 border-[#173b31] bg-white p-4 sm:min-h-36 sm:p-5">
      <div>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[.12em] text-[#587063]">{label}</p>
        <p
          className={`font-['Barlow_Condensed'] font-bold tracking-tight text-[#173b31] ${largeValue ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"}`}
        >
          {value}
        </p>
      </div>
      <div className={`${iconBg} ${iconColor} hidden p-2.5 sm:block`}>{icon}</div>
    </div>
  );
}
