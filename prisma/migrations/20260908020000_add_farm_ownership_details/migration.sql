-- Store the free-form description of a member's role on the farm when they
-- select "Others" for farm ownership status.
ALTER TABLE "Application" ADD COLUMN "farmOwnershipDetails" TEXT;