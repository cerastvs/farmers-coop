-- Replace the numeric age field on membership applications with a birth date.
-- Existing rows are backfilled with an approximate birth date derived from age.
ALTER TABLE "Application"
  ADD COLUMN "birthDate" TIMESTAMP(3);

UPDATE "Application"
SET "birthDate" = (CURRENT_DATE - ("age" * INTERVAL '1 year'))::timestamp(3)
WHERE "birthDate" IS NULL;

ALTER TABLE "Application"
  ALTER COLUMN "birthDate" SET NOT NULL;

ALTER TABLE "Application"
  DROP COLUMN "age";