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
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-gray-900">{name}</span>
        <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">
          {status}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-gray-400 text-xs">Loan Amount:</p>
          <p className="font-semibold text-gray-800">{loanAmount}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Next Payment:</p>
          <p className="font-semibold text-gray-800">{nextPayment}</p>
        </div>
      </div>
    </div>
  );
}
