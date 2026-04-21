"use client";

import { use, useEffect, useState } from "react";
import { DashboardHeader } from "./components/DashboardHeader";
import { SummaryCard } from "./components/SummaryCard";
import { QuickActionButton } from "./components/QuickActionButton";
import { ActiveLoanCard } from "./components/ActiveLoanCard";
import { RecentTransactions } from "./components/RecentTransactions";
import { quickActions } from "./data";
import { useUser } from "../hooks/useUser";
import {
  IconLoan,
  IconMachine,
  IconBalance,
  IconCalendar,
} from "@/components/icons";

interface DashboardStats {
  activeLoansCount: number;
  borrowedMachinesCount: number;
  totalDebt: number;
  nextPaymentDue: string | null;
  activeLoans: Array<{
    name: string;
    status: string;
    loanAmount: number;
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
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
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
      value: `₱${stats?.totalDebt.toLocaleString() || "0"}`,
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
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <DashboardHeader />
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-12">
          <div className="bg-white rounded-[2.5rem] shadow-xl p-10 text-center border border-green-50">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <IconCalendar className="text-yellow-600 w-10 h-10" />
            </div>
            <h1 className="text-3xl font-black text-[#2d6a2d] mb-4">
              Application Pending
            </h1>
            <p className="text-gray-600 text-lg mb-8 max-w-md mx-auto">
              Your membership application is currently being reviewed by the cooperative board.
              We will notify you once your account has been approved.
            </p>
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-2">
                What can you do?
              </p>
              <p className="text-gray-700">
                You can update your application details at any time by clicking 
                <span className="font-bold text-[#51a808]"> "Edit Profile" </span> 
                in the menu above.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <DashboardHeader />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.name?.split(" ")[0] || "Farmer"}!
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Here&apos;s an overview of your cooperative account
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </div>

        <section>
          <h2 className="text-base font-bold text-gray-800 mb-3">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {quickActions.map((action) => (
              <QuickActionButton key={action.label} {...action} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-800 mb-3">
            Active Loans
          </h2>
          <div className="space-y-3">
            {stats?.activeLoans && stats.activeLoans.length > 0 ? (
              stats.activeLoans.map((loan) => (
                <ActiveLoanCard
                  key={loan.name}
                  name={loan.name}
                  status={loan.status}
                  loanAmount={`₱${loan.loanAmount.toLocaleString()}`}
                  nextPayment={new Date(loan.nextPayment).toLocaleDateString(
                    "en-US",
                    { month: "long", day: "numeric", year: "numeric" },
                  )}
                />
              ))
            ) : (
              <div className="bg-white p-4 rounded-xl border border-gray-100 text-center text-gray-500 italic">
                No active loans
              </div>
            )}
          </div>
        </section>

        <RecentTransactions
          transactions={
            stats?.recentTransactions.map((t) => ({
              ...t,
              amount: `₱${t.amount.toLocaleString()}`,
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
