-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "interestRate" DECIMAL(5,2) NOT NULL DEFAULT 2.00;

-- CreateTable
CREATE TABLE "CoopSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "CoopSetting_pkey" PRIMARY KEY ("key")
);

-- Seed registry of cooperative settings with the default loan interest rate.
INSERT INTO "CoopSetting" ("key", "value")
VALUES ('loanInterestRate', '2')
ON CONFLICT ("key") DO NOTHING;