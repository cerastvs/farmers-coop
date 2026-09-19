-- Link completed supply purchases to their Payment records.

ALTER TABLE "Payment" ADD COLUMN "supplyTransactionId" TEXT;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_supplyTransactionId_fkey"
  FOREIGN KEY ("supplyTransactionId") REFERENCES "SupplyTransaction"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Payment_supplyTransactionId_key"
  ON "Payment"("supplyTransactionId");

-- Backfill Payment records for completed supply purchases that were recorded
-- before payments were linked to supply transactions.
INSERT INTO "Payment" (
  "id",
  "userId",
  "type",
  "amount",
  "paymentMethod",
  "status",
  "paidAt",
  "verifiedAt",
  "receiptNo",
  "entryType",
  "initiatedBy",
  "source",
  "remarks",
  "supplyTransactionId"
)
SELECT
  gen_random_uuid(),
  st."userId",
  'SUPPLY_PURCHASE'::"PaymentType",
  st."totalPrice",
  'ON_SITE'::"PaymentMethod",
  'VERIFIED'::"PaymentStatus",
  COALESCE(st."reviewedAt", st."createdAt"),
  COALESCE(st."reviewedAt", st."createdAt"),
  'RCP-' || EXTRACT(YEAR FROM COALESCE(st."reviewedAt", st."createdAt"))
    || '-' || UPPER(LEFT(replace(st."id"::text, '-', ''), 8)),
  'MANUAL'::"EntryType",
  'SECRETARY'::"InitiatedBy",
  'OFFICE'::"EntrySource",
  'Supply purchase: ' || s."productName" || ' × ' || st."quantity",
  st."id"
FROM "SupplyTransaction" st
JOIN "Supply" s ON s."id" = st."supplyId"
WHERE st."type" = 'PURCHASE'
  AND st."status" = 'COMPLETED'
  AND NOT EXISTS (
    SELECT 1 FROM "Payment" p WHERE p."supplyTransactionId" = st."id"
  );