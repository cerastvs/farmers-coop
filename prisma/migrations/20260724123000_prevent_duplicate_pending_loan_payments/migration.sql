-- A borrower may have only one pending payment submission for a loan.
-- This also serializes the evidence-upload reservation across concurrent requests.
CREATE UNIQUE INDEX "Payment_one_pending_loan_payment_per_borrower_loan"
ON "Payment"("userId", "loanId")
WHERE "type" = 'LOAN_PAYMENT' AND "status" = 'PENDING';
