-- Add application-fee payment audit trail fields. Each stores an authenticated
-- user ID (never a role name) so the UI can resolve the uploader/verifier from
-- the User record. proofUploadedBy and verifiedBy are deliberately separate.
ALTER TABLE "Payment"
  ADD COLUMN "proofUploadedById" TEXT,
  ADD COLUMN "proofUploadedAt" TIMESTAMP(3),
  ADD COLUMN "declinedById" TEXT,
  ADD COLUMN "declinedAt" TIMESTAMP(3),
  ADD COLUMN "paidAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_proofUploadedById_fkey" FOREIGN KEY ("proofUploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_declinedById_fkey" FOREIGN KEY ("declinedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;