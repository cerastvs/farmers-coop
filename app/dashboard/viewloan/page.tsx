"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "../components/DashboardHeader";
import { LoanCard } from "./components/LoanCard";
import { PaymentHistoryTable } from "./components/PaymentHistoryTable";
import { IconChevronLeft } from "@/components/icons";

interface LoanData {
  id: string;
  name: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "ACTIVE" | "PAID";
  amount: number;
  due: string;
}

interface PaymentRecord {
  receiptNo: string | null;
  paidAt: string;
  amount: number;
  loanName: string;
}

export default function ViewLoanPage() {
  const [loans, setLoans] = useState<LoanData[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLoans() {
      try {
        const res = await fetch("/api/loans");
        if (res.ok) {
          const data = await res.json();
          setLoans(data.loans);
          setPaymentHistory(data.paymentHistory);
        }
      } catch (error) {
        console.error("Failed to fetch loans:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchLoans();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

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
          {loans.length > 0 ? (
            loans.map((loan) => (
              <LoanCard 
                key={loan.id} 
                loan={{
                  ...loan,
                  amount: `₱${loan.amount.toLocaleString()}`,
                  due: new Date(loan.due).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                }} 
              />
            ))
          ) : (
            <div className="bg-white p-8 rounded-xl border border-gray-100 text-center text-gray-500">
              No loan records found.
            </div>
          )}
        </div>

        <PaymentHistoryTable 
          records={paymentHistory.map(p => ({
            ...p,
            amount: `₱${p.amount.toLocaleString()}`,
            paidAt: new Date(p.paidAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          }))} 
        />

        <div className="h-4" />
      </main>
    </div>
  );
}
