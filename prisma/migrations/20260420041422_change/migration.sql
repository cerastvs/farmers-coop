-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "name" TEXT NOT NULL DEFAULT 'Cash Loan',
ADD COLUMN     "status" "LoanStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "LoanPayment" ADD COLUMN     "receiptNo" TEXT;
