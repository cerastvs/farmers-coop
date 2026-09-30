-- AlterTable
-- Condition recorded at return time. returnNote holds the officer's QC note,
-- or the good-condition default when the note box was left blank, so every
-- return carries a condition instead of a silent null. returnHasIssue is a
-- separate flag so reports can filter on "returned with an issue" without
-- matching on free text.
ALTER TABLE "MachineRequest" ADD COLUMN     "returnNote" TEXT,
ADD COLUMN     "returnHasIssue" BOOLEAN NOT NULL DEFAULT false;
