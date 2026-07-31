-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('ONLINE', 'MANUAL');

-- CreateEnum
CREATE TYPE "InitiatedBy" AS ENUM ('MEMBER', 'SECRETARY');

-- CreateEnum
CREATE TYPE "EntrySource" AS ENUM ('PORTAL', 'OFFICE', 'WALK_IN');

-- AlterEnum
ALTER TYPE "PaymentType" ADD VALUE 'MEMBERSHIP_FEE';
ALTER TYPE "PaymentType" ADD VALUE 'OTHER_FEE';

-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "auditId" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "createdByRole" "Role",
ADD COLUMN     "entryType" "EntryType" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN     "initiatedBy" "InitiatedBy" NOT NULL DEFAULT 'MEMBER',
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "source" "EntrySource" NOT NULL DEFAULT 'PORTAL';

-- AlterTable
ALTER TABLE "MachineRequest" ADD COLUMN     "auditId" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "createdByRole" "Role",
ADD COLUMN     "entryType" "EntryType" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN     "initiatedBy" "InitiatedBy" NOT NULL DEFAULT 'MEMBER',
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "source" "EntrySource" NOT NULL DEFAULT 'PORTAL';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "auditId" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "createdByRole" "Role",
ADD COLUMN     "entryType" "EntryType" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN     "initiatedBy" "InitiatedBy" NOT NULL DEFAULT 'MEMBER',
ADD COLUMN     "receiptNo" TEXT,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "source" "EntrySource" NOT NULL DEFAULT 'PORTAL';

-- AlterTable
ALTER TABLE "SupplyTransaction" ADD COLUMN     "auditId" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "createdByRole" "Role",
ADD COLUMN     "entryType" "EntryType" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN     "initiatedBy" "InitiatedBy" NOT NULL DEFAULT 'MEMBER',
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "source" "EntrySource" NOT NULL DEFAULT 'PORTAL';
