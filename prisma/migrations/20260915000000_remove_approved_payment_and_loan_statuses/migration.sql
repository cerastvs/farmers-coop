-- Remap legacy payment statuses into the active set before dropping the enum values.
UPDATE "Payment" SET "status" = 'VERIFIED' WHERE "status" = 'APPROVED';
UPDATE "Payment" SET "status" = 'PENDING' WHERE "status" = 'PENDING_APPROVAL';
UPDATE "Payment" SET "status" = 'REJECTED' WHERE "status" = 'DECLINED';

-- Remap the legacy loan approval stage directly to active.
UPDATE "Loan" SET "status" = 'ACTIVE' WHERE "status" = 'APPROVED';
UPDATE "LoanStatusHistory" SET "status" = 'ACTIVE' WHERE "status" = 'APPROVED';

-- AlterEnum
ALTER TYPE "PaymentStatus" DROP VALUE 'PENDING_APPROVAL';
ALTER TYPE "PaymentStatus" DROP VALUE 'APPROVED';
ALTER TYPE "PaymentStatus" DROP VALUE 'DECLINED';

-- AlterEnum
ALTER TYPE "LoanStatus" DROP VALUE 'APPROVED';