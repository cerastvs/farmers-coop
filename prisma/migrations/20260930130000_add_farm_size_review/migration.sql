-- AddFarmSizeReview
-- A member cannot change their own farm size outright, because one hectare is
-- one machine-day and so raising it would hand out machine time. The requested
-- value is held in pendingFarmSize and reviewed by an officer; farmSize keeps
-- granting the previous allowance until it is approved.

-- Create the FarmSizeStatus enum.
CREATE TYPE "FarmSizeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Farm size is now optional. Only a farm owner has hectares; a farm worker
-- leaves it null, and nothing per-hectare is computed for them.
ALTER TABLE "Application" ALTER COLUMN "farmSize" DROP NOT NULL;

-- Add review columns to Application.
ALTER TABLE "Application"
  ADD COLUMN "pendingFarmSize" DOUBLE PRECISION,
  ADD COLUMN "farmSizeStatus" "FarmSizeStatus",
  ADD COLUMN "farmSizeReviewedBy" TEXT,
  ADD COLUMN "farmSizeReviewedAt" TIMESTAMP(3),
  ADD COLUMN "farmSizeRejectionReason" TEXT;

-- Foreign keys for the farm size reviewer relation.
ALTER TABLE "Application" ADD CONSTRAINT "Application_farmSizeReviewedBy_fkey"
  FOREIGN KEY ("farmSizeReviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The officer queue reads every pending change, so index the status.
CREATE INDEX "Application_farmSizeStatus_idx" ON "Application"("farmSizeStatus");

-- Extend NotificationType enum with farm size review events.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FARM_SIZE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FARM_SIZE_REJECTED';
