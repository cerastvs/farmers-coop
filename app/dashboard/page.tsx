"use client";

import { DashboardHeader } from "./components/DashboardHeader";
import { SummaryCard } from "./components/SummaryCard";
import { QuickActionButton } from "./components/QuickActionButton";
import { ActiveLoanCard } from "./components/ActiveLoanCard";
import { RecentTransactions } from "./components/RecentTransactions";
import {
  summaryCards,
  quickActions,
  activeLoans,
  recentTransactions,
} from "./data";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <DashboardHeader />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, Juan!
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
            {activeLoans.map((loan) => (
              <ActiveLoanCard key={loan.name} {...loan} />
            ))}
          </div>
        </section>

        <RecentTransactions transactions={recentTransactions} />

        <div className="h-4" />
      </main>
    </div>
  );
}
