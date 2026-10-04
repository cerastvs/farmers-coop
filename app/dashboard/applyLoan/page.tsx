"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "../components/DashboardHeader";
import { MemberPageHeader } from "../components/MemberPageHeader";
import memberStyles from "../components/member.module.css";
import { ApplyLoanCard } from "./components/ApplyLoanCard";
import {
  LoanRequestsCard,
  type LoanRequest,
} from "./components/LoanRequestsCard";
import { IconChevronLeft, IconInfoCircle } from "@/components/icons";
import { Money } from "@/components/Money";
import { useMarkAlertSeen } from "../hooks/useAlertSeen";
import { fetchWithTimeout } from "../hooks/fetchWithTimeout";
import { cashLoanBalance, hasOpenCashLoan } from "./eligibility";

export default function ApplyLoanPage() {
  useMarkAlertSeen("rejectedLoans");
  const [cashDebt, setCashDebt] = useState<number | null>(null);
  const [supplyDebt, setSupplyDebt] = useState<number | null>(null);
  const [hasGuarantor, setHasGuarantor] = useState<boolean | null>(null);
  const [guarantorStatus, setGuarantorStatus] = useState<string | null>(null);
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [loansError, setLoansError] = useState<string | null>(null);

  const fetchStats = async () => {
    setStatsError(null);
    try {
      const res = await fetchWithTimeout("/api/dashboard/stats");
      if (!res.ok) throw new Error("Loan eligibility details are unavailable.");
      const data = await res.json();
        // This page applies for a cash loan, so only the cash balance can
        // block it. The stats endpoint already reports cash and supply debt
        // separately; this used to gate on the combined total, so a member
        // who owed nothing on a cash loan but still owed for supplies was told
        // their balance was outstanding and the form stayed disabled.
        const { balance, supplyBalance } = cashLoanBalance({
          cash: typeof data.cashDebt === "number" ? data.cashDebt : 0,
          supply: typeof data.supplyDebt === "number" ? data.supplyDebt : 0,
        });
        setCashDebt(balance);
        setSupplyDebt(supplyBalance);
        setHasGuarantor(data.hasGuarantor);
        setGuarantorStatus(
          typeof data.guarantorStatus === "string"
            ? data.guarantorStatus
            : null,
        );
    } catch (error) {
      setStatsError(error instanceof Error ? error.message : "Loan eligibility details are unavailable.");
    } finally {
      setLoading(false);
    }
  };

  const fetchLoans = async () => {
    setLoansError(null);
    try {
      const res = await fetchWithTimeout("/api/loans");
      if (!res.ok) throw new Error("Your loan requests are unavailable.");
      const data = await res.json();
        setLoans(data.loans ?? []);
    } catch (error) {
      setLoansError(error instanceof Error ? error.message : "Your loan requests are unavailable.");
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchLoans();
  }, []);

  // Scoped to cash loans for the same reason as the balance gate above: an
  // open supply loan is a separate account and does not stop a cash
  // application. Previously any pending or active loan counted here, so
  // holding supplies locked a member out of the cash form entirely.
  const hasPendingRequest = hasOpenCashLoan(loans);

  return (
    <div className={memberStyles.surface}>
      <DashboardHeader />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-6">
        <MemberPageHeader title="Apply for a loan" description="Request a cash loan and review your existing requests." indicator={guarantorStatus === "REJECTED" ? <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-red-200" /> : undefined} />
        {statsError && <div role="alert" className={memberStyles.error}>{statsError}<button onClick={() => void fetchStats()}>Try again</button></div>}
        {loansError && <div role="alert" className={memberStyles.error}>{loansError}<button onClick={() => void fetchLoans()}>Try again</button></div>}

        {hasGuarantor === false && guarantorStatus === "REJECTED" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
            <IconInfoCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-800">
                Guarantor Rejected
              </p>
              <p className="text-xs text-red-700 mt-1 leading-relaxed">
                Your guarantor was not approved. Update your guarantor through{" "}
                <span className="font-semibold">Edit Profile</span> and wait for
                the president or treasurer to review it before applying for a
                loan.
              </p>
              <Link
                href="/registration?focus=guarantor"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-800"
              >
                <IconChevronLeft className="w-3.5 h-3.5 rotate-180" />
                Update Guarantor
              </Link>
            </div>
          </div>
        )}

        {hasGuarantor === false && guarantorStatus === "PENDING" && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
            <IconInfoCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">
                Guarantor Approval Pending
              </p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                Your guarantor is on file but has{" "}
                <span className="font-semibold">not yet been verified</span>.
                Please wait for the president or treasurer to approve it before
                applying for a loan.
              </p>
            </div>
          </div>
        )}

        {hasGuarantor === false &&
          guarantorStatus !== "PENDING" &&
          guarantorStatus !== "REJECTED" && (
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
              <Link
                href="/registration?focus=guarantor"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#b45309] px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-700"
              >
                <IconChevronLeft className="w-3.5 h-3.5 rotate-180" />
                Add Guarantor
              </Link>
            </div>
          </div>
        )}

        {cashDebt !== null && cashDebt > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
            <IconInfoCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">
                Outstanding Cash Balance Detected
              </p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                You still owe <span className="font-bold"><Money value={cashDebt} /></span> on your cash loan.
                Please note that new cash loan applications may not be approved until your current balance is fully settled.
              </p>
            </div>
          </div>
        )}

        {/* Shown for context, not as a blocker: supply debt is a separate
            account that does not prevent applying for a cash loan. */}
        {supplyDebt !== null && supplyDebt > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
            <IconInfoCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-blue-800">
                Outstanding Supply Balance
              </p>
              <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                You still owe <span className="font-bold"><Money value={supplyDebt} /></span> on your supply loan.
                This does not prevent you from applying for a cash loan.
              </p>
            </div>
          </div>
        )}

        <ApplyLoanCard
          cashBalance={cashDebt}
          hasGuarantor={hasGuarantor}
          guarantorStatus={guarantorStatus}
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
