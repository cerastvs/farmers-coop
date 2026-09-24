-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startMonth" INTEGER NOT NULL,
    "startDay" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineSeasonCapacity" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "maxHectareDays" DOUBLE PRECISION,

    CONSTRAINT "MachineSeasonCapacity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Season_startMonth_startDay_idx" ON "Season"("startMonth", "startDay");

-- CreateIndex
CREATE INDEX "MachineSeasonCapacity_machineId_idx" ON "MachineSeasonCapacity"("machineId");

-- CreateIndex
CREATE UNIQUE INDEX "MachineSeasonCapacity_seasonId_machineId_key" ON "MachineSeasonCapacity"("seasonId", "machineId");

-- AddForeignKey
ALTER TABLE "MachineSeasonCapacity" ADD CONSTRAINT "MachineSeasonCapacity_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineSeasonCapacity" ADD CONSTRAINT "MachineSeasonCapacity_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

