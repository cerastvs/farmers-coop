-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE 'PENDING_PAYMENT';
ALTER TYPE "ApplicationStatus" ADD VALUE 'PENDING_APPLICATION_REVIEW';

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PENDING_APPROVAL';
ALTER TYPE "PaymentStatus" ADD VALUE 'APPROVED';
ALTER TYPE "PaymentStatus" ADD VALUE 'DECLINED';

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('ONLINE', 'ON_SITE');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "applicationId" TEXT,
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'ONLINE';

-- CreateIndex
CREATE INDEX "Payment_applicationId_idx" ON "Payment"("applicationId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
