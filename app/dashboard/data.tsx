import React from "react";
import {
  IconLoan,
  IconMachine,
  IconBalance,
  IconCalendar,
  IconApplyLoan,
  IconRentMachine,
  IconBuySupplies,
  IconViewLoans,
} from "../../components/icons";

export const summaryCards = [
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

export const quickActions = [
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

export const activeLoans = [
  {
    name: "Cash Loan",
    status: "Active",
    loanAmount: "₱5,000",
    nextPayment: "April 13, 2026",
  },
];

export const recentTransactions = [
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
