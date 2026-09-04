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
    <div className="flex items-center justify-between rounded-2xl border border-[#e2e7dc] bg-white p-5 shadow-sm shadow-[#173a2b]/[.03] transition hover:-translate-y-0.5 hover:shadow-md">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#718176]">{label}</p>
        <p
          className={`font-extrabold tracking-tight text-[#173a2b] ${largeValue ? "text-2xl" : "text-3xl"}`}
        >
          {value}
        </p>
      </div>
      <div className={`${iconBg} ${iconColor} rounded-xl p-3`}>{icon}</div>
    </div>
  );
}
