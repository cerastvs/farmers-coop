import React from "react";

interface ApplyLoanCardProps {
  currentBalance: number | null;
  isLoading: boolean;
}

export function ApplyLoanCard({ currentBalance, isLoading }: ApplyLoanCardProps) {
  const hasBalance = currentBalance !== null && currentBalance > 0;

  return (
    <div className="w-full max-w-md md:max-w-2xl mx-auto bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b">
        <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-green-100 text-green-700 text-xl font-bold">
          ₱
        </div>
        <div>
          <h2 className="font-semibold text-lg">Cash Loan</h2>
          <p className="text-sm text-gray-500">
            Apply for loans with flexible payment terms
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-100/60 rounded-xl p-4">
            <p className="text-sm text-gray-600">Maximum Loan Amount</p>
            <p className="text-2xl font-bold text-green-700">₱5,000</p>
          </div>

          <div className="bg-blue-100/60 rounded-xl p-4">
            <p className="text-sm text-gray-600">Current Loan Balance</p>
            <p className="text-2xl font-bold text-blue-700">
              {isLoading ? "..." : `₱${(currentBalance || 0).toLocaleString()}`}
            </p>
          </div>
        </div>

        <div className="bg-purple-100/60 rounded-xl p-4">
          <p className="text-sm text-gray-600">Payment Terms</p>
          <p className="text-2xl font-bold text-purple-600">6–24 months</p>
        </div>

        {/* Button */}
        <button 
          disabled={hasBalance}
          className={`w-full md:w-auto font-medium px-6 py-3 rounded-xl transition ${
            hasBalance 
              ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200" 
              : "bg-green-700 hover:bg-green-800 text-white"
          }`}
        >
          {hasBalance ? "Settlement Required" : "Apply for Loan"}
        </button>
      </div>
    </div>
  );
}
