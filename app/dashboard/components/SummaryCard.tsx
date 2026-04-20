import React from "react";

interface SummaryCardProps {
  label: string;
  value: string;
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
    <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between border border-gray-100">
      <div>
        <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
        <p
          className={`font-bold text-gray-900 ${largeValue ? "text-2xl" : "text-3xl"}`}
        >
          {value}
        </p>
      </div>
      <div className={`${iconBg} ${iconColor} p-3 rounded-xl`}>{icon}</div>
    </div>
  );
}
