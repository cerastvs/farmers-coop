import {
  IconApplyLoan,
  IconRentMachine,
  IconBuySupplies,
  IconViewLoans,
} from "@/components/icons";

export const quickActions = [
  {
    label: "Apply Loan",
    icon: <IconApplyLoan />,
    iconBg: "bg-green-100",
    iconColor: "text-green-700",
    href: "/dashboard/applyLoan",
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
    href: "/dashboard/viewloan",
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
