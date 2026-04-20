import React from "react";
import { Loan } from "../data";

const STATUS_STYLES: Record<Loan["status"], string> = {
  ACTIVE: "bg-blue-100 text-blue-700",
  PAID: "bg-gray-100 text-gray-500",
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-600",
};

const STATUS_LABEL: Record<Loan["status"], string> = {
  ACTIVE: "Active",
  PAID: "Paid",
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export function StatusBadge({ status }: { status: Loan["status"] }) {
  return (
    <span className={`text-xs font-bold px-3 py-1 rounded-full ${STATUS_STYLES[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
