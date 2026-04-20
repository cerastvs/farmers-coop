"use client";

import Link from "next/link";
import { DashboardHeader } from "../components/DashboardHeader";
import { LoanCard } from "./components/LoanCard";
import { PaymentHistoryTable } from "./components/PaymentHistoryTable";
import { loans, paymentHistory } from "./data";
import { IconChevronLeft } from "@/components/icons";

export default function ViewLoanPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <DashboardHeader />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-6">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-[#2d6a2d] font-medium mb-3 hover:underline"
          >
            <IconChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Loan Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track and manage your loan accounts
          </p>
        </div>

        <div className="space-y-4">
          {loans.map((loan) => (
            <LoanCard key={loan.id} loan={loan} />
          ))}
        </div>

        <PaymentHistoryTable records={paymentHistory} />

        <div className="h-4" />
      </main>
    </div>
  );
}
