-- Phase 13 schema-integrity hotfix (see PHASE13_AUDIT.md §3.1, §3.2, §1.1)
--
-- Purpose: this is NOT a Phase 13 feature migration (Phase 13 is audit-only)
-- and NOT part of Phase 14. It closes three gaps the audit found so that
-- `prisma validate`/`prisma generate` succeed again and Phase 14's new
-- subscription models can be added to a clean schema:
--
--   1. UserOutlet had no relation back to Tenant even though Tenant listed
--      `userOutlets` — this is a hard Prisma schema-validation error, not
--      just a lint issue. (§3.1, blocking)
--   2. Category, Unit, and CustomerVisit each carry a `tenant_id` column
--      with no foreign key to `tenants` at all — enforced only by
--      application-layer convention. (§3.2, high)
--   3. UserRole had no `tenant_id` column, so it couldn't be filtered or
--      indexed by tenant on its own without joining through `roles`. (§1.1)
--   4. Two more dangling relations turned up while re-checking every
--      relation pair in the schema for this migration (not caught by the
--      original audit's read-through): `Customer.whatsappCarts` pointed at
--      a field that doesn't exist on WhatsAppCart, and
--      `User.whatsAppMessages @relation("WhatsAppMessageCreatedBy")` had no
--      matching owning field on WhatsAppMessage. Both were unused
--      Prisma-only relation declarations with no backing database column,
--      so removing them (in schema.prisma, not here) required no SQL.
--
-- Every affected row already has a valid, application-written tenant_id
-- (Category/Unit/CustomerVisit) or a roleId whose tenant can be looked up
-- (UserRole), so this is purely additive: no column is dropped, no existing
-- data is rewritten beyond the UserRole backfill in step 3.
--
-- As with the Phase 11/12 migration, this was hand-written and hand-checked
-- against the schema (no live Postgres/Prisma engine reachable in this
-- sandbox). Run `npx prisma generate` and this migration against a real
-- database, and spot-check the pre-flight counts below, before trusting it
-- beyond dev/staging.

BEGIN;

-- ── 0. Pre-flight integrity check (read-only, informational) ───────────
-- If either of these returns rows, STOP — it means the "every row already
-- has a valid tenant_id" assumption above doesn't hold in this database,
-- and the FK constraints in step 2 below will fail. Fix or remove the
-- offending rows first; do not blindly proceed.
--
--   SELECT id, tenant_id FROM categories
--     WHERE tenant_id NOT IN (SELECT id FROM tenants);
--   SELECT id, tenant_id FROM units
--     WHERE tenant_id NOT IN (SELECT id FROM tenants);
--   SELECT id, tenant_id FROM customer_visits
--     WHERE tenant_id NOT IN (SELECT id FROM tenants);

-- ── 1. UserOutlet → Tenant (blocking fix, §3.1) ─────────────────────────
-- Column and data already correct (see Phase 11 migration); only the FK
-- constraint was missing.
ALTER TABLE "user_outlets" ADD CONSTRAINT "user_outlets_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 2. Category / Unit / CustomerVisit → Tenant (§3.2) ──────────────────
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "categories_tenant_id_idx" ON "categories"("tenant_id");

ALTER TABLE "units" ADD CONSTRAINT "units_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "units_tenant_id_idx" ON "units"("tenant_id");

ALTER TABLE "customer_visits" ADD CONSTRAINT "customer_visits_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "customer_visits_tenant_id_customer_id_idx" ON "customer_visits"("tenant_id", "customer_id");
CREATE INDEX "customer_visits_user_id_idx" ON "customer_visits"("user_id");

-- ── 3. UserRole gains tenant_id (§1.1) ──────────────────────────────────
-- Nullable first, backfilled from the role's own tenant (a role and every
-- UserRole assignment pointing at it are always same-tenant today —
-- enforced in users.service.ts assignRoles()), then locked to NOT NULL.
ALTER TABLE "user_roles" ADD COLUMN "tenant_id" TEXT;

UPDATE "user_roles" ur SET "tenant_id" = r."tenant_id"
FROM "roles" r WHERE r."id" = ur."role_id";

ALTER TABLE "user_roles" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "user_roles_tenant_id_idx" ON "user_roles"("tenant_id");
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

COMMIT;

-- ── Post-migration manual steps ─────────────────────────────────────────
-- 1. Run the pre-flight queries in step 0 against production/staging data
--    BEFORE running this migration there, not after.
-- 2. Run `npx prisma generate` and confirm `npx prisma validate` is clean —
--    this is the actual proof that every relation in the schema (not just
--    the ones this migration adds columns/constraints for) now pairs up.
--    A full static pass over every relation in schema.prisma was run
--    alongside this migration and came back clean (0 dangling relations);
--    `prisma validate` itself could not be run in this sandbox
--    (binaries.prisma.sh is not network-reachable here — same limitation
--    noted in the Phase 11/12 migration). Re-verify with the real CLI
--    before trusting this beyond dev/staging.
-- 3. Not done here (deliberately, needs a product decision first per
--    PHASE13_AUDIT.md §3.3/§3.4, not a schema-integrity fix):
--      - clientTransactionId idempotency scope (tenant-wide vs per-outlet)
--      - tenant cancellation/offboarding semantics (soft-delete vs cascade)
--      - Category/Unit name uniqueness per tenant (needs a dedup pass on
--        existing data first — adding @@unique blind could fail on
--        pre-existing duplicates)
