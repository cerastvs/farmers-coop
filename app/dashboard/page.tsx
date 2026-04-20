"use client";

import { useState } from "react";
import { logout } from "../login/actions";

function IconLoan() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
    >
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <line x1="12" y1="12" x2="12" y2="16" />
      <line x1="10" y1="14" x2="14" y2="14" />
    </svg>
  );
}

function IconMachine() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconBalance() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconApplyLoan() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-6 h-6"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function IconRentMachine() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-6 h-6"
    >
      <rect x="2" y="7" width="20" height="10" rx="2" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
      <path d="M2 12h20" />
    </svg>
  );
}

function IconBuySupplies() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-6 h-6"
    >
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function IconViewLoans() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-6 h-6"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-6 h-6"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4 text-gray-400"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

const summaryCards = [
  {
    label: "Active Loans",
    value: "1",
    icon: <IconLoan />,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
  },
  {
    label: "Borrowed Machines",
    value: "1",
    icon: <IconMachine />,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    label: "Current Balance",
    value: "₱5,000",
    icon: <IconBalance />,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-500",
    largeValue: true,
  },
  {
    label: "Next Payment Due",
    value: "JAN 25, 2026",
    icon: <IconCalendar />,
    iconBg: "bg-yellow-100",
    iconColor: "text-yellow-600",
    largeValue: true,
  },
];

const quickActions = [
  {
    label: "Apply Loan",
    icon: <IconApplyLoan />,
    iconBg: "bg-green-100",
    iconColor: "text-green-700",
    href: "#",
  },
  {
    label: "Rent Machine",
    icon: <IconRentMachine />,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-700",
    href: "#",
  },
  {
    label: "Buy Supplies",
    icon: <IconBuySupplies />,
    iconBg: "bg-yellow-100",
    iconColor: "text-yellow-700",
    href: "#",
  },
  {
    label: "View Loans",
    icon: <IconViewLoans />,
    iconBg: "bg-purple-100",
    iconColor: "text-purple-700",
    href: "#",
  },
];

const activeLoans = [
  {
    name: "Cash Loan",
    status: "Active",
    loanAmount: "₱5,000",
    nextPayment: "April 13, 2026",
  },
];

const recentTransactions = [
  {
    type: "Loan Payment",
    date: "Mar 28, 2026",
    amount: "₱2,500",
    debit: true,
  },
  {
    type: "Fertilizer Purchase",
    date: "Mar 25, 2026",
    amount: "₱1,200",
    debit: true,
  },
  {
    type: "Fertilizer Purchase",
    date: "Mar 20, 2026",
    amount: "₱3,500",
    debit: true,
  },
];

function SummaryCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  largeValue,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  largeValue?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between border border-gray-100">
      <div>
        <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
        <p
          className={`font-bold text-gray-900 ${largeValue ? "text-2xl" : "text-3xl"}`}
        >
          {value}
        </p>
      </div>
      <div className={`${iconBg} ${iconColor} p-3 rounded-xl`}>{icon}</div>
    </div>
  );
}

function QuickActionButton({
  label,
  icon,
  iconBg,
  iconColor,
  href,
}: {
  label: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex flex-col items-center justify-center gap-2 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all active:scale-95"
    >
      <div className={`${iconBg} ${iconColor} p-3 rounded-xl`}>{icon}</div>
      <span className="text-xs font-semibold text-gray-700 text-center leading-tight">
        {label}
      </span>
    </a>
  );
}

export default function Dashboard() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#2d6a2d] text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <path d="M17 8C8 10 5.9 16.17 3.82 19.82A1 1 0 0 0 5 21C6 20.49 9 19 12 19c4 0 9-2 9-8.99 0 0-1.01 1-4 1" />
              <path d="M8 16c0-4 4-8 9-8" />
            </svg>
            <span className="font-bold text-base tracking-wide">FarmCoop</span>
          </div>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 rounded-lg hover:bg-white/20 transition-colors"
            aria-label="Menu"
          >
            <IconMenu />
          </button>
        </div>

        {menuOpen && (
          <div className="absolute right-4 top-14 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 w-48 z-50">
            <form action={logout}>
              <button
                type="submit"
                className="w-full text-left px-4 py-3 text-sm text-red-600 font-medium hover:bg-red-50 transition-colors"
              >
                Logout
              </button>
            </form>
          </div>
        )}
      </header>

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
              <div
                key={loan.name}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-900">
                    {loan.name}
                  </span>
                  <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">
                    {loan.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs">Loan Amount:</p>
                    <p className="font-semibold text-gray-800">
                      {loan.loanAmount}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Next Payment:</p>
                    <p className="font-semibold text-gray-800">
                      {loan.nextPayment}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-800 mb-3">
            Recent Transactions
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-3 px-4 py-2 bg-gray-50 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-500">Type</span>
              <span className="text-xs font-semibold text-gray-500">Date</span>
              <span className="text-xs font-semibold text-gray-500">
                Amount
              </span>
            </div>

            {recentTransactions.map((tx, idx) => (
              <div
                key={idx}
                className="grid grid-cols-3 items-center px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-800 pr-2">
                  {tx.type}
                </span>
                <span className="text-xs text-gray-500">{tx.date}</span>
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm font-bold ${tx.debit ? "text-red-500" : "text-green-600"}`}
                  >
                    {tx.debit ? "-" : "+"}
                    {tx.amount}
                  </span>
                  <IconChevronRight />
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="h-4" />
      </main>
    </div>
  );
}
