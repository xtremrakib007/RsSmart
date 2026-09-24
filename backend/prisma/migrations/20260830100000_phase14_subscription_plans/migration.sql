-- Phase 14 — Subscription Plan Models (DB foundation only)
--
-- Adds `subscription_plans` (global catalog — not tenant-scoped, every
-- company picks from the same plan list) and `subscriptions` (tenant-scoped,
-- one row per subscription period/change so history is kept rather than
-- overwritten). No billing/payment/checkout logic here — see Phase
-- 15 (lifecycle service), Phase 17 (API), Phase 20/21 (payment adapter).
--
-- As with prior hand-written migrations in this repo, no live Postgres/
-- Prisma engine was reachable from the build sandbox to run
-- `prisma migrate dev` / `prisma validate`. Run both for real against a
-- copy of a production-like database before trusting this beyond dev.
--
-- Purely additive: two new tables, no existing table touched, no data
-- rewritten, nothing dropped.

BEGIN;

-- ── 1. Subscription status enum ─────────────────────────────────────────
CREATE TYPE "SubscriptionStatus" AS ENUM (
    'TRIALING',
    'ACTIVE',
    'PAST_DUE',
    'SUSPENDED',
    'CANCELLED',
    'EXPIRED'
);

-- ── 2. subscription_plans (global catalog) ──────────────────────────────
CREATE TABLE "subscription_plans" (
    "id"              TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "slug"            TEXT NOT NULL,
    "description"     TEXT,
    "price_monthly"   DECIMAL(12,2) NOT NULL,
    "currency"        TEXT NOT NULL DEFAULT 'MYR',
    "max_outlets"     INTEGER NOT NULL,
    "max_users"       INTEGER NOT NULL,
    "max_pos_devices" INTEGER NOT NULL,
    "features"        JSONB NOT NULL DEFAULT '{}',
    "is_active"       BOOLEAN NOT NULL DEFAULT true,
    "sort_order"      INTEGER NOT NULL DEFAULT 0,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_plans_slug_key" ON "subscription_plans"("slug");

-- ── 3. subscriptions (tenant-scoped) ─────────────────────────────────────
CREATE TABLE "subscriptions" (
    "id"                    TEXT NOT NULL,
    "tenant_id"             TEXT NOT NULL,
    "plan_id"               TEXT NOT NULL,
    "status"                "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "trial_ends_at"         TIMESTAMP(3),
    "current_period_start"  TIMESTAMP(3),
    "current_period_end"    TIMESTAMP(3),
    "cancel_at_period_end"  BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at"          TIMESTAMP(3),
    "suspended_at"          TIMESTAMP(3),
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "subscriptions_tenant_id_status_idx" ON "subscriptions"("tenant_id", "status");
CREATE INDEX "subscriptions_tenant_id_created_at_idx" ON "subscriptions"("tenant_id", "created_at");

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
