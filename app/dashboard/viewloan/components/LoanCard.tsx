import React from "react";
import { Loan } from "../data";
import { StatusBadge } from "./StatusBadge";
import { IconLoan, IconBell } from "@/components/icons";

export function LoanCard({ loan }: { loan: Loan }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="bg-green-100 text-green-700 p-2.5 rounded-xl">
          <IconLoan />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm">{loan.name}</p>
          <p className="text-xs text-gray-400">Loan ID: {loan.id}</p>
        </div>
        <StatusBadge status={loan.status} />
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-0.5">Loan Amount</p>
        <p className="text-2xl font-bold text-gray-900">{loan.amount}</p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <IconBell />
        <div>
          <p className="text-xs text-yellow-600 font-medium">
            Next Payment Due
          </p>
          <p className="text-sm font-bold text-yellow-700">
            {loan.due}
          </p>
        </div>
      </div>
    </div>
  );
}
