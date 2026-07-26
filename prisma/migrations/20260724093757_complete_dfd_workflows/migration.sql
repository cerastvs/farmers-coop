-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('SUMMARY', 'MEMBERS', 'LOANS', 'PAYMENTS', 'SUPPLIES', 'MACHINES', 'AUDIT');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AuditTrail" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "purpose" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT,
ADD COLUMN     "termMonths" INTEGER NOT NULL DEFAULT 6;

-- AlterTable
ALTER TABLE "Log" ADD COLUMN     "action" TEXT NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN     "success" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "loanId" TEXT,
ADD COLUMN     "referenceNo" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "data" JSONB,
ADD COLUMN     "type" "ReportType" NOT NULL DEFAULT 'SUMMARY';

-- AlterTable
ALTER TABLE "SupplyTransaction" ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanStatusHistory" ADD CONSTRAINT "LoanStatusHistory_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditTrail" ADD CONSTRAINT "AuditTrail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
