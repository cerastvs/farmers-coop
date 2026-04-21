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
        }

        const statsRes = await fetch("/api/dashboard/stats");
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
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
