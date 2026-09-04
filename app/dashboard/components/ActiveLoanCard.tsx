import React from "react";

interface ActiveLoanCardProps {
  id?: string;
  name: string;
  status: string;
  type?: string;
  loanAmount: string;
  remainingBalance?: string;
  nextPayment: string;
}

export function ActiveLoanCard({
  name,
  status,
  type,
  loanAmount,
  remainingBalance,
  nextPayment,
}: ActiveLoanCardProps) {
  const isOverdue = status.toLowerCase().includes("overdue");
  const typeLabel = type === "SUPPLY" ? "Fertilizer / Supply" : "Cash Loan";

  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm shadow-[#173a2b]/[.03] ${
        isOverdue ? "border-red-300" : "border-[#e2e7dc]"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-[#173a2b]">{name}</span>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#eef2e8] px-2.5 py-1 text-[10px] font-bold text-[#718176]">
            {typeLabel}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              isOverdue
                ? "bg-red-100 text-red-700"
                : "bg-[#edf5df] text-[#39733e]"
            }`}
          >
            {status}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-xs font-medium text-[#718176]">Loan Amount</p>
          <p className="font-bold text-[#315646]">{loanAmount}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-[#718176]">Outstanding</p>
          <p className="font-bold text-[#315646]">
            {remainingBalance ?? loanAmount}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-[#718176]">Due</p>
          <p className="font-bold text-[#315646]">{nextPayment}</p>
        </div>
      </div>
    </div>
  );
}
