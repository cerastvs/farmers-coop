-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "principalAmount" DECIMAL(10,2);

-- Backfill existing interest-bearing loans with their reconstructed principal.
UPDATE "Loan" SET "principalAmount" = ROUND("amount" * 100 / (1 + "interestRate" / 100)) / 100
WHERE "principalAmount" IS NULL AND "interestRate" > 0;