import React from "react";
import { PaymentRecord } from "../data";
import { IconChevronRight } from "@/components/icons";

export function PaymentHistoryTable({ records }: { records: PaymentRecord[] }) {
  return (
    <section>
      <h2 className="text-base font-bold text-gray-800 mb-3">
        Payment History
      </h2>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-500">
            Receipt No.
          </span>
          <span className="text-xs font-semibold text-gray-500">Date</span>
          <span className="text-xs font-semibold text-gray-500 text-right">
            Amount
          </span>
        </div>

        {records.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            No payment records found.
          </div>
        ) : (
          records.map((record, idx) => (
            <div
              key={idx}
              className="grid grid-cols-3 items-center px-4 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
            >
              <span className="text-xs font-mono text-gray-700 break-all pr-1">
                {record.receiptNo ?? <span className="italic text-gray-400">—</span>}
              </span>
              <span className="text-xs text-gray-500">{record.paidAt}</span>
              <div className="flex items-center justify-end gap-1.5">
                <span className="text-sm font-bold text-green-600">
                  {record.amount}
                </span>
                <IconChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
