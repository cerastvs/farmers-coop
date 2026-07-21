import React from "react";

interface ActiveLoanCardProps {
  name: string;
  status: string;
  loanAmount: string;
  nextPayment: string;
}

export function ActiveLoanCard({
  name,
  status,
  loanAmount,
  nextPayment,
}: ActiveLoanCardProps) {
  return (
    <div className="rounded-2xl border border-[#e2e7dc] bg-white p-5 shadow-sm shadow-[#173a2b]/[.03]">
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-[#173a2b]">{name}</span>
        <span className="rounded-full bg-[#edf5df] px-3 py-1 text-xs font-bold text-[#39733e]">
          {status}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs font-medium text-[#718176]">Loan Amount</p>
          <p className="font-bold text-[#315646]">{loanAmount}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-[#718176]">Next Payment</p>
          <p className="font-bold text-[#315646]">{nextPayment}</p>
        </div>
      </div>
    </div>
  );
}
