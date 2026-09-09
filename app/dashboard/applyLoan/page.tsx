"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "../components/DashboardHeader";
import { ApplyLoanCard } from "./components/ApplyLoanCard";
import {
  LoanRequestsCard,
  type LoanRequest,
} from "./components/LoanRequestsCard";
import { IconChevronLeft, IconInfoCircle } from "@/components/icons";
import { Money } from "@/components/Money";
import { useMarkAlertSeen } from "../hooks/useAlertSeen";

export default function ApplyLoanPage() {
  useMarkAlertSeen("rejectedLoans");
  const [totalDebt, setTotalDebt] = useState<number | null>(null);
  const [hasGuarantor, setHasGuarantor] = useState<boolean | null>(null);
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/dashboard/stats");
      if (res.ok) {
        const data = await res.json();
        setTotalDebt(data.totalDebt);
        setHasGuarantor(data.hasGuarantor);
      }
    } catch (error) {
      console.error("Failed to fetch balance:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLoans = async () => {
    try {
      const res = await fetch("/api/loans");
      if (res.ok) {
        const data = await res.json();
        setLoans(data.loans ?? []);
      }
    } catch (error) {
      console.error("Failed to fetch loans:", error);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchLoans();
  }, []);

  const hasPendingRequest =
    loans.filter((l) => l.status === "PENDING" || l.status === "APPROVED")
      .length > 0;

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
          <h1 className="text-2xl font-bold text-gray-900">Apply for a Loan</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Select the loan type that best fits your farming needs
          </p>
        </div>

        {hasGuarantor === false && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
            <IconInfoCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">
                Guarantor Required
              </p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                You need a guarantor on file before the cooperative can consider
                a money loan or supply loan. Add your guarantor through{" "}
                <span className="font-semibold">Edit Profile</span> in your
                dashboard, then return here to apply.
              </p>
            </div>
          </div>
        )}

        {totalDebt !== null && totalDebt > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
            <IconInfoCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">
                Outstanding Balance Detected
              </p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                You still have an outstanding balance of <span className="font-bold"><Money value={totalDebt} /></span>. 
                Please note that new loan applications may not be approved until your current balance is fully settled.
              </p>
            </div>
          </div>
        )}

        <ApplyLoanCard
          currentBalance={totalDebt}
          hasGuarantor={hasGuarantor}
          hasPendingRequest={hasPendingRequest}
          isLoading={loading}
          onSubmitted={fetchLoans}
        />

        <LoanRequestsCard loans={loans} onCancelled={fetchLoans} />

        <div className="bg-[#f0f9f0] border border-green-100 rounded-2xl p-6 text-center space-y-3 mt-8">
          <h3 className="text-lg font-bold text-[#2d6a2d]">
            Need help choosing?
          </h3>
          <p className="text-sm text-gray-600 max-w-lg mx-auto leading-relaxed">
            Our cooperative advisors are here to help you find the best loan for
            your farming projects. Contact us for personalized assistance.
          </p>
          <button className="px-6 py-2.5 bg-white border border-[#2d6a2d] text-[#2d6a2d] rounded-xl font-bold text-sm hover:bg-green-50 transition-colors">
            Contact Advisor
          </button>
        </div>

        <div className="h-4" />
      </main>
    </div>
  );
}
