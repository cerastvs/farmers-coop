-- Keep farm role changes pending alongside farm size changes. Both values
-- affect machine and per-hectare supply access and must be reviewed together.
ALTER TABLE "Application"
  ADD COLUMN "pendingFarmOwnership" "FarmOwnership",
  ADD COLUMN "pendingFarmOwnershipDetails" TEXT;

-- Existing farm-size requests become complete farm-detail snapshots so they
-- remain reviewable after the queue starts requiring a requested role.
UPDATE "Application"
SET
  "pendingFarmOwnership" = "farmOwnership",
  "pendingFarmOwnershipDetails" = "farmOwnershipDetails"
WHERE "farmSizeStatus" = 'PENDING';
