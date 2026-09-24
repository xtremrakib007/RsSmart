-- Phase 11: SaaS foundation & multi-outlet architecture
-- Phase 12: Authentication, RBAC & authorization hardening
--
-- Written by hand (no live database was reachable from the build sandbox to
-- run `prisma migrate dev`). Review and run this against a copy of a
-- production-like database before applying to production, per the Phase 11
-- completion gate ("Migration tested on copy of production-like DB").
--
-- Strategy: add new tables/columns as NULLABLE first, backfill every existing
-- tenant with a default outlet and point its existing operational records at
-- it, THEN tighten the outlet_id columns to NOT NULL. This keeps the
-- migration safe to run against a database that already has production data,
-- per the roadmap's "every existing record maps safely to the initial/
-- default outlet" requirement.

BEGIN;

-- ── 1. New enum for outlet status ──────────────────────────────────────
CREATE TYPE "OutletStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- ── 2. Outlets table ────────────────────────────────────────────────────
CREATE TABLE "outlets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
    "currency" TEXT NOT NULL DEFAULT 'MYR',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" "OutletStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outlets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outlets_tenant_id_code_key" ON "outlets"("tenant_id", "code");
CREATE INDEX "outlets_tenant_id_status_idx" ON "outlets"("tenant_id", "status");

ALTER TABLE "outlets" ADD CONSTRAINT "outlets_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 3. User <-> Outlet assignment table ────────────────────────────────
CREATE TABLE "user_outlets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_outlets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_outlets_user_id_outlet_id_key" ON "user_outlets"("user_id", "outlet_id");
CREATE INDEX "user_outlets_tenant_id_outlet_id_idx" ON "user_outlets"("tenant_id", "outlet_id");

ALTER TABLE "user_outlets" ADD CONSTRAINT "user_outlets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_outlets" ADD CONSTRAINT "user_outlets_outlet_id_fkey"
    FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 4. RBAC hardening columns ───────────────────────────────────────────
ALTER TABLE "roles" ADD COLUMN "scope_all_outlets" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;

-- Existing pre-Phase-12 roles are grandfathered as tenant-wide so nobody is
-- silently locked out of data the day this migration runs. New roles created
-- through the Phase 12 onboarding/invite flow set this explicitly per role.
UPDATE "roles" SET "scope_all_outlets" = true;

-- ── 5. Backfill: one default outlet per existing tenant ─────────────────
INSERT INTO "outlets" ("id", "tenant_id", "code", "name", "is_default", "status", "created_at", "updated_at")
SELECT gen_random_uuid(), "id", 'MAIN', "name" || ' - Main Outlet', true, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tenants";

-- Give every existing user access to their tenant's default outlet so
-- outlet-scoped queries keep working immediately after this migration.
INSERT INTO "user_outlets" ("id", "tenant_id", "user_id", "outlet_id", "is_default", "assigned_at")
SELECT gen_random_uuid(), u."tenant_id", u."id", o."id", true, CURRENT_TIMESTAMP
FROM "users" u
JOIN "outlets" o ON o."tenant_id" = u."tenant_id" AND o."is_default" = true;

-- ── 6. Add outlet_id as NULLABLE to operational tables ───────────────────
ALTER TABLE "inventory" ADD COLUMN "outlet_id" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN "outlet_id" TEXT;
ALTER TABLE "orders" ADD COLUMN "outlet_id" TEXT;
ALTER TABLE "pos_sessions" ADD COLUMN "outlet_id" TEXT;
ALTER TABLE "pos_cash_movements" ADD COLUMN "outlet_id" TEXT;

-- ── 7. Backfill outlet_id (and stock_movements.tenant_id) from each
--       tenant's default outlet ────────────────────────────────────────
UPDATE "inventory" i SET "outlet_id" = o."id"
FROM "outlets" o WHERE o."tenant_id" = i."tenant_id" AND o."is_default" = true;

UPDATE "stock_movements" sm SET
    "tenant_id" = inv."tenant_id",
    "outlet_id" = inv."outlet_id"
FROM "inventory" inv WHERE inv."id" = sm."inventory_id";

UPDATE "orders" ord SET "outlet_id" = o."id"
FROM "outlets" o WHERE o."tenant_id" = ord."tenant_id" AND o."is_default" = true;

UPDATE "pos_sessions" ps SET "outlet_id" = o."id"
FROM "outlets" o WHERE o."tenant_id" = ps."tenant_id" AND o."is_default" = true;

UPDATE "pos_cash_movements" pcm SET "outlet_id" = o."id"
FROM "outlets" o WHERE o."tenant_id" = pcm."tenant_id" AND o."is_default" = true;

-- ── 8. Tighten outlet_id (and stock_movements.tenant_id) to NOT NULL ────
ALTER TABLE "inventory" ALTER COLUMN "outlet_id" SET NOT NULL;
ALTER TABLE "stock_movements" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "stock_movements" ALTER COLUMN "outlet_id" SET NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "outlet_id" SET NOT NULL;
ALTER TABLE "pos_sessions" ALTER COLUMN "outlet_id" SET NOT NULL;
ALTER TABLE "pos_cash_movements" ALTER COLUMN "outlet_id" SET NOT NULL;

-- ── 9. Re-key inventory's uniqueness to be per-outlet ────────────────────
-- Stock is now tracked independently per outlet, so the old
-- (tenant_id, product_id, warehouse_id) uniqueness would incorrectly
-- collapse the same product's rows across outlets.
ALTER TABLE "inventory" DROP CONSTRAINT IF EXISTS "inventory_tenant_id_product_id_warehouse_id_key";
CREATE UNIQUE INDEX "inventory_tenant_id_outlet_id_product_id_warehouse_id_key"
    ON "inventory"("tenant_id", "outlet_id", "product_id", "warehouse_id");
CREATE INDEX "inventory_tenant_id_outlet_id_idx" ON "inventory"("tenant_id", "outlet_id");

-- ── 10. Indexes for tenant_id + outlet_id combinations ───────────────────
CREATE INDEX "stock_movements_tenant_id_outlet_id_created_at_idx" ON "stock_movements"("tenant_id", "outlet_id", "created_at");
CREATE INDEX "orders_tenant_id_outlet_id_created_at_idx" ON "orders"("tenant_id", "outlet_id", "created_at");
CREATE INDEX "pos_sessions_tenant_id_outlet_id_status_idx" ON "pos_sessions"("tenant_id", "outlet_id", "status");
DROP INDEX IF EXISTS "pos_cash_movements_tenant_id_session_id_created_at_idx";
CREATE INDEX "pos_cash_movements_tenant_id_outlet_id_session_id_created_idx" ON "pos_cash_movements"("tenant_id", "outlet_id", "session_id", "created_at");

-- ── 11. Foreign keys ───────────────────────────────────────────────────
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_outlet_id_fkey"
    FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_outlet_id_fkey"
    FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_outlet_id_fkey"
    FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_outlet_id_fkey"
    FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_cash_movements" ADD CONSTRAINT "pos_cash_movements_outlet_id_fkey"
    FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;

-- ── Post-migration manual steps (documented, not automated here) ───────
-- 1. Run the tenant-isolation / outlet-isolation integration tests in
--    backend/test/outlets before pointing this at real customer data.
-- 2. Decide, per existing tenant, whether any of their pre-existing roles
--    should be narrowed from scope_all_outlets = true to false, and assign
--    the relevant users to specific outlets via user_outlets.
-- 3. If a tenant actually operates multiple physical locations already,
--    split their single "MAIN" outlet into the correct set of outlets and
--    move the relevant inventory/orders/pos_sessions rows accordingly —
--    this migration only creates a safe single default, it does not infer
--    real-world outlet boundaries from existing data.
