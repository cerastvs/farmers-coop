-- Move the shared hectare-day limit onto the season itself: one single
-- limit per harvest season, pooled across all machines and members.
-- The per-machine capacity rows are removed.

-- DropForeignKey
ALTER TABLE "MachineSeasonCapacity" DROP CONSTRAINT "MachineSeasonCapacity_machineId_fkey";

-- DropForeignKey
ALTER TABLE "MachineSeasonCapacity" DROP CONSTRAINT "MachineSeasonCapacity_seasonId_fkey";

-- AlterTable
ALTER TABLE "Season" ADD COLUMN "maxHectareDays" DOUBLE PRECISION;

-- DropTable
DROP TABLE "MachineSeasonCapacity";