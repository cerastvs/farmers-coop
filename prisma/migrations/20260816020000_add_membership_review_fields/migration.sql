-- Add membership application review fields. The President is the only role
-- allowed to approve/deny membership applications. rejectionReason holds the
-- predefined denial reason and rejectionDetails holds the optional explanation.
ALTER TABLE "Application"
  ADD COLUMN "rejectionDetails" TEXT;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;