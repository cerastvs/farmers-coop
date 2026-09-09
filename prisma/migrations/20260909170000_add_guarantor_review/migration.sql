-- AddGuarantorReview
-- Create the GuarantorStatus enum.
CREATE TYPE "GuarantorStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Add review columns to Application. guarantorStatus is nullable and only
-- meaningful once a member has a guarantor on file.
ALTER TABLE "Application"
  ADD COLUMN "guarantorStatus" "GuarantorStatus",
  ADD COLUMN "guarantorReviewedBy" TEXT,
  ADD COLUMN "guarantorReviewedAt" TIMESTAMP(3),
  ADD COLUMN "guarantorRejectionReason" TEXT;

-- Extend NotificationType enum with guarantor events.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'GUARANTOR_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'GUARANTOR_REJECTED';

-- Foreign keys for the guarantor reviewer relation.
ALTER TABLE "Application" ADD CONSTRAINT "Application_guarantorReviewedBy_fkey"
  FOREIGN KEY ("guarantorReviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;