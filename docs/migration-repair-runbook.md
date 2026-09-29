# Migration Repair Runbook

## Status

**Not fixed. Intentionally deferred.**

No schema, data, or migration-history change has been made. This document
records what is known so the repair can be designed per environment later.

The live development database currently matches `prisma/schema.prisma`, but that
match was reached by applying patches by hand. Replaying the committed
migrations against an empty database does **not** reproduce it.

## What breaks a fresh replay

Running `prisma migrate deploy` against an empty database fails. In order:

1. **`20260908010000_add_crop_machine_tables`** drops
   `Application.farmMachinery`. The column is not present at this point in the
   chain, so the `DROP COLUMN` fails.

2. **`20260909170000_add_guarantor_review`** alters the `NotificationType` enum
   using values that were never created, because the migration that created
   them did not run.

3. **`20260915000000_remove_approved_payment_and_loan_statuses`** issues
   `ALTER TYPE ... DROP VALUE`. PostgreSQL has no `DROP VALUE` syntax for enum
   types in any released version — this statement is invalid, not
   version-dependent. Removing an enum value requires either recreating the
   type (which requires redefining every dependent column) or leaving the value
   in place and ignoring it in application code.

4. **Machine enum and column drift** has no migration history at all. The live
   database was patched manually.

## Constraints on any repair

- **Do not edit the committed migrations.** They are already applied in the live
  database; rewriting them changes the meaning of history.
- Repair must be **per environment**. Other environments are unknown and may
  diverge differently, so a single repair script cannot be assumed correct
  everywhere.
- Any enum-value removal is a breaking schema change: it requires recreating the
  type and every column that uses it. Prefer **leaving the value in the enum and
  ignoring it in code**, which is what the application already does.

## Recommended approach

1. **Establish a baseline per environment.** Capture the applied migration IDs
   from `prisma_migrations` and diff the live schema against
   `prisma/schema.prisma`. Do this read-only first.

2. **Decide the target.** Two viable strategies, and they are not
   interchangeable:

   - **Keep history, add a forward migration.** Write new migrations that bring
     a *partially migrated* database up to `schema.prisma`, leaving the broken
     migrations in place. This does not make a fresh replay work, but it makes
     existing databases repairable and is the lower-risk option.
   - **Squash to a single baseline.** Generate one migration representing the
     current schema, mark it as the baseline for new environments, and document
     that existing environments do not replay history. This makes fresh
     provisioning work, but only if every environment is baselined deliberately.

3. **Test against a restored copy**, never against the live database. A restored
   copy of the *current* database is representative; an empty database is not,
   because the live one was patched by hand.

4. **Choose the strategy per environment** and record the decision, since the
   environments may need different answers.

## Before doing any of this

- Confirm which environments exist and which of them would actually be rebuilt.
- Confirm whether `APPROVED` is a legal `PaymentStatus` / `LoanStatus` value in
  each environment, or whether it was already removed by hand.
- Get explicit approval. This is out of scope for the current phase, and it is
  the one piece of work here that cannot be validated by the test suite.
