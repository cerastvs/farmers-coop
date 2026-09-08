-- Move the free-form crop type and farm machinery strings on membership
-- applications into dedicated child tables so multiple values can be stored.
CREATE TABLE "ApplicationCrop" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,

  CONSTRAINT "ApplicationCrop_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationMachine" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,

  CONSTRAINT "ApplicationMachine_pkey" PRIMARY KEY ("id")
);

-- Migrate existing scalar values into rows.
INSERT INTO "ApplicationCrop" ("id", "applicationId", "name")
SELECT gen_random_uuid()::text, "id",
       trim(unnest(string_to_array("cropType", ',')))
FROM "Application"
WHERE "cropType" IS NOT NULL AND trim("cropType") <> '';

INSERT INTO "ApplicationMachine" ("id", "applicationId", "name")
SELECT gen_random_uuid()::text, "id",
       trim(unnest(string_to_array("farmMachinery", ',')))
FROM "Application"
WHERE "farmMachinery" IS NOT NULL AND trim("farmMachinery") <> '';

ALTER TABLE "Application" DROP COLUMN "cropType";
ALTER TABLE "Application" DROP COLUMN "farmMachinery";

-- AddForeignKey
ALTER TABLE "ApplicationCrop" ADD CONSTRAINT "ApplicationCrop_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationMachine" ADD CONSTRAINT "ApplicationMachine_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ApplicationCrop_applicationId_idx" ON "ApplicationCrop"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationMachine_applicationId_idx" ON "ApplicationMachine"("applicationId");