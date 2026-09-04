"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "./components/DashboardHeader";
import { SummaryCard } from "./components/SummaryCard";
import { QuickActionButton } from "./components/QuickActionButton";
import { ActiveLoanCard } from "./components/ActiveLoanCard";
import { RecentTransactions } from "./components/RecentTransactions";
import { Money } from "@/components/Money";
import { quickActions } from "./data";
import { useUser } from "../hooks/useUser";
import {
  IconLoan,
  IconMachine,
  IconBalance,
  IconCalendar,
} from "@/components/icons";
import {
  ArrowRight,
  Clock,
  CreditCard,
  FileSearch,
  Loader2,
  ShieldCheck,
} from "lucide-react";

interface DashboardStats {
  activeLoansCount: number;
  overdueLoansCount: number;
  borrowedMachinesCount: number;
  totalDebt: number;
  cashDebt: number;
  supplyDebt: number;
  nextPaymentDue: string | null;
  activeLoans: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    displayStatus: string;
    loanAmount: number;
    remainingBalance: number;
    nextPayment: string;
  }>;
  recentTransactions: Array<{
    type: string;
    date: string;
    amount: number;
    debit: boolean;
  }>;
}

export default function Dashboard() {
  const { user, setUser } = useUser();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const userRes = await fetch("/api/me");
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);

          // Only fetch stats if not a pending applicant
          if (!(userData.role === "APPLICANT" && userData.hasApplied)) {
            const statsRes = await fetch("/api/dashboard/stats");
            if (statsRes.ok) {
              const statsData = await statsRes.json();
              setStats(statsData);
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [setUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f7f2] flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#39733e]"></div>
      </div>
    );
  }

  const summaryCards = [
    {
      label: "Active Loans",
      value: stats?.activeLoansCount.toString() || "0",
      icon: <IconLoan />,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
    },
    {
      label: "Borrowed Machines",
      value: stats?.borrowedMachinesCount.toString() || "0",
      icon: <IconMachine />,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
    },
    {
      label: "Current Balance",
      value: <Money value={stats?.totalDebt || 0} />,
      icon: <IconBalance />,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-500",
      largeValue: true,
    },
    {
      label: "Next Payment Due",
      value: stats?.nextPaymentDue
        ? new Date(stats.nextPaymentDue)
            .toLocaleDateString("en-US", {
              month: "short",
              day: "2-digit",
              year: "numeric",
            })
            .toUpperCase()
        : "NONE",
      icon: <IconCalendar />,
      iconBg: "bg-yellow-100",
      iconColor: "text-yellow-600",
      largeValue: true,
    },
  ];

  const isApplicant = user?.role === "APPLICANT";
  const hasApplied = user?.hasApplied;

  if (isApplicant && hasApplied) {
    return <ApplicantPendingScreen />;
  }

  return (
    <div className="min-h-screen bg-[#f7f7f2] flex flex-col">
      <DashboardHeader />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 space-y-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#4f7e38]">Member portal</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#173a2b]">
            Welcome back, {user?.name?.split(" ")[0] || "Farmer"}!
          </h1>
          <p className="mt-1 text-sm text-[#718176]">
            Here&apos;s an overview of your cooperative account
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </div>

        <section>
          <h2 className="mb-3 text-base font-extrabold text-[#173a2b]">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {quickActions.map((action) => (
              <QuickActionButton key={action.label} {...action} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-base font-extrabold text-[#173a2b]">
            Active Loans &amp; Debts
          </h2>

          {stats && stats.overdueLoansCount > 0 && (
            <div className="mb-3 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-red-100 text-red-700">
                <Clock size={14} />
              </span>
              <div>
                <p className="text-sm font-bold text-red-700">
                  You have {stats.overdueLoansCount} overdue loan
                  {stats.overdueLoansCount > 1 ? "s" : ""}
                </p>
                <p className="text-xs text-red-600">
                  Please settle outstanding balances as soon as possible to
                  avoid additional charges.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {stats?.activeLoans && stats.activeLoans.length > 0 ? (
              stats.activeLoans.map((loan) => (
                <ActiveLoanCard
                  key={loan.id}
                  name={loan.name}
                  status={loan.displayStatus}
                  type={loan.type}
                  loanAmount={<Money value={loan.loanAmount} />}
                  remainingBalance={<Money value={loan.remainingBalance} />}
                  nextPayment={new Date(loan.nextPayment).toLocaleDateString(
                    "en-US",
                    { month: "long", day: "numeric", year: "numeric" },
                  )}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[#ccd9c8] bg-white p-5 text-center text-sm text-[#718176]">
                No active loans
              </div>
            )}
          </div>

          {stats && stats.totalDebt > 0 && (
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <span className="rounded-xl bg-white border border-[#e2e7dc] px-4 py-2">
                <span className="text-[#718176]">Cash debt: </span>
                <span className="font-bold text-[#173a2b]">
                  <Money value={stats.cashDebt} />
                </span>
              </span>
              <span className="rounded-xl bg-white border border-[#e2e7dc] px-4 py-2">
                <span className="text-[#718176]">Fertilizer / supply debt: </span>
                <span className="font-bold text-[#173a2b]">
                  <Money value={stats.supplyDebt} />
                </span>
              </span>
            </div>
          )}
        </section>

        <RecentTransactions
          transactions={
            stats?.recentTransactions.map((t) => ({
              ...t,
              amount: <Money value={t.amount} />,
              date: new Date(t.date).toLocaleDateString("en-US", {
                month: "short",
                day: "2-digit",
                year: "numeric",
              }),
            })) || []
          }
        />

        <div className="h-4" />
      </main>
    </div>
  );
}

interface ApplicantPaymentStatus {
  application: {
    id: string;
    status: string;
    rejectionReason: string | null;
    rejectionDetails: string | null;
    reviewedAt: string | null;
    reviewedBy: { id: string; name: string | null; username: string; role: string } | null;
  };
  payment: {
    status: string;
    rejectionReason: string | null;
  } | null;
}

function ApplicantPendingScreen() {
  const [status, setStatus] = useState<ApplicantPaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/application-fee")
      .then(async (res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => setStatus(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f7f2] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-[#39733e]" size={32} />
      </div>
    );
  }

  const appStatus = status?.application.status ?? "PENDING_PAYMENT";
  const paymentStatus = status?.payment?.status ?? null;
  const declined = paymentStatus === "DECLINED";
  const pending = paymentStatus === "PENDING_APPROVAL";
  const approved = paymentStatus === "APPROVED";
  const inReview = appStatus === "PENDING_APPLICATION_REVIEW";
  const membershipApproved = appStatus === "APPROVED";
  const rejected = appStatus === "REJECTED";

  let icon: React.ReactNode = <CreditCard className="text-amber-600 w-10 h-10" />;
  let iconBg = "bg-yellow-100";
  let title = "Application fee required";
  let body = "Your application was submitted. Pay the application fee to continue with your membership.";
  let actionLabel = "Pay application fee";

  if (pending) {
    icon = <Clock className="text-orange-500 w-10 h-10" />;
    iconBg = "bg-orange-100";
    title = "Payment proof submitted";
    body = "Your payment proof is being verified by the President. You will be notified once it is approved.";
    actionLabel = "View payment status";
  } else if (approved || inReview) {
    icon = <FileSearch className="text-blue-600 w-10 h-10" />;
    iconBg = "bg-blue-100";
    title = "Payment Approved";
    body = "Your application fee has been verified. Your membership application is now being reviewed by the President.";
    actionLabel = "View payment status";
  } else if (membershipApproved) {
    icon = <ShieldCheck className="text-green-600 w-10 h-10" />;
    iconBg = "bg-green-100";
    title = "Membership approved";
    body = "Congratulations! You are now an approved cooperative member.";
  } else if (declined) {
    icon = <FileSearch className="text-red-500 w-10 h-10" />;
    iconBg = "bg-red-100";
    title = "Payment proof declined";
    body = status?.payment?.rejectionReason
      ? `Reason: ${status.payment.rejectionReason}. Please submit a new proof of payment.`
      : "Your submitted payment proof could not be approved. Please submit a new proof of payment.";
    actionLabel = "Submit new proof";
  } else if (rejected) {
    icon = <FileSearch className="text-red-500 w-10 h-10" />;
    iconBg = "bg-red-100";
    title = "Membership Application Denied";
    body =
      "Your membership application was reviewed and not approved. Your payment remains separate and approved.";
    actionLabel = "View application status";
  }

  return (
    <div className="min-h-screen bg-[#f7f7f2] flex flex-col">
      <DashboardHeader />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-12">
        <div className="rounded-[2.5rem] border border-[#dce8d2] bg-white p-10 text-center shadow-xl shadow-[#173a2b]/[.06]">
          <div className={`w-20 h-20 ${iconBg} rounded-full flex items-center justify-center mx-auto mb-6`}>
            {icon}
          </div>
          <h1 className="text-3xl font-black text-[#2d6a2d] mb-4">{title}</h1>
          <p className="text-gray-600 text-lg mb-8 max-w-md mx-auto">{body}</p>

          {rejected && (
            <div className="mb-8 max-w-md mx-auto space-y-4 rounded-3xl border border-red-200 bg-red-50 p-6 text-left">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-red-600">Reason</p>
                <p className="mt-1 text-sm font-semibold text-red-800">
                  {status?.application.rejectionReason ?? "No reason was provided."}
                </p>
              </div>
              {status?.application.rejectionDetails && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-red-600">Message from the President</p>
                  <p className="mt-1 text-sm text-red-800">{status.application.rejectionDetails}</p>
                </div>
              )}
              {status?.application.reviewedBy && (
                <p className="text-xs text-red-700/80">
                  Decided by: {status.application.reviewedBy.name ?? status.application.reviewedBy.username} — President
                  {status.application.reviewedAt
                    ? ` · ${new Date(status.application.reviewedAt).toLocaleString("en-PH", {
                        month: "short",
                        day: "2-digit",
                        year: "numeric",
                      })}`
                    : ""}
                </p>
              )}
            </div>
          )}

          {!membershipApproved && !rejected && (
            <Link
              href="/dashboard/payment"
              className="inline-flex items-center gap-2 rounded-xl bg-[#174b36] px-6 py-3 font-bold text-white shadow-lg shadow-[#174b36]/15 transition hover:bg-[#0e3b2a]"
            >
              {actionLabel}
              <ArrowRight size={16} />
            </Link>
          )}

          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 mt-8">
            <p className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-2">
              What can you do?
            </p>
            <p className="text-gray-700">
              You can update your application details at any time by clicking{" "}
              <span className="font-bold text-[#51a808]">&quot;Edit Profile&quot;</span>{" "}
              in the menu above.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
