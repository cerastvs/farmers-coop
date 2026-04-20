import React from "react";
import { IconChevronRight } from "../../../components/icons";

interface Transaction {
  type: string;
  date: string;
  amount: string;
  debit: boolean;
}

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  return (
    <section>
      <h2 className="text-base font-bold text-gray-800 mb-3">
        Recent Transactions
      </h2>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-3 px-4 py-2 bg-gray-50 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-500">Type</span>
          <span className="text-xs font-semibold text-gray-500">Date</span>
          <span className="text-xs font-semibold text-gray-500">Amount</span>
        </div>

        {transactions.map((tx, idx) => (
          <div
            key={idx}
            className="grid grid-cols-3 items-center px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-medium text-gray-800 pr-2">
              {tx.type}
            </span>
            <span className="text-xs text-gray-500">{tx.date}</span>
            <div className="flex items-center justify-between">
              <span
                className={`text-sm font-bold ${tx.debit ? "text-red-500" : "text-green-600"}`}
              >
                {tx.debit ? "-" : "+"}
                {tx.amount}
              </span>
              <IconChevronRight />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
