export interface Loan {
  id: string;
  name: string; // Loan type label, e.g. "Cash Loan"
  status: "PENDING" | "APPROVED" | "REJECTED" | "ACTIVE" | "PAID";
  amount: string;
  remainingBalance: string;
  due: string; // next payment date
}

export interface PaymentRecord {
  receiptNo: string | null; // nullable - matches schema
  paidAt: string;
  amount: string;
}

export const loans: Loan[] = [
  {
    id: "LOAN-0001",
    name: "Cash Loan",
    status: "ACTIVE",
    amount: "₱5,000",
    remainingBalance: "4000",
    due: "April 15, 2026",
  },
];

export const paymentHistory: PaymentRecord[] = [
  { receiptNo: "RCP-2926-9315", paidAt: "March 15, 2026", amount: "₱500" },
  { receiptNo: "RCP-2926-9326", paidAt: "March 20, 2026", amount: "₱500" },
  { receiptNo: "RCP-2926-9215", paidAt: "February 15, 2026", amount: "₱500" },
];
