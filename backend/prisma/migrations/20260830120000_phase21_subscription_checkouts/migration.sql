-- Phase 21 — Production Payment Integration
--
-- Adds the persistence Phase 20 deliberately deferred: a local table
-- mapping a payment provider's own checkout/bill reference back to the
-- tenant/subscription/plan it belongs to (see PHASE20-PAYMENT-PROVIDER-
-- ADAPTER.md, "Known gap"). This is what lets the webhook handler resolve
-- "which tenant is this providerReference for" and "have I already
-- processed this one" without trusting anything in the webhook payload
-- itself.
--
-- As with prior hand-written migrations in this repo, no live Postgres/
-- Prisma engine was reachable from the build sandbox to run
-- `prisma migrate dev` / `prisma validate`. Run both for real against a
-- copy of a production-like database before trusting this beyond dev.
--
-- Purely additive: one new enum, one new table, no existing table touched.

BEGIN;

-- ── 1. Checkout status enum ──────────────────────────────────────────────
CREATE TYPE "CheckoutStatus" AS ENUM (
    'PENDING',
    'SUCCEEDED',
    'FAILED',
    'REFUNDED',
    'CANCELLED'
);

-- ── 2. subscription_checkouts (tenant-scoped) ────────────────────────────
CREATE TABLE "subscription_checkouts" (
    "id"                    TEXT NOT NULL,
    "tenant_id"             TEXT NOT NULL,
    "subscription_id"       TEXT NOT NULL,
    "plan_id"               TEXT NOT NULL,
    "provider"              TEXT NOT NULL,
    "provider_reference"    TEXT NOT NULL,
    "status"                "CheckoutStatus" NOT NULL DEFAULT 'PENDING',
    "amount"                DECIMAL(12,2) NOT NULL,
    "currency"              TEXT NOT NULL DEFAULT 'MYR',
    "checkout_url"          TEXT NOT NULL,
    "webhook_processed_at"  TIMESTAMP(3),
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_checkouts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_checkouts_provider_reference_key" ON "subscription_checkouts"("provider_reference");
CREATE INDEX "subscription_checkouts_tenant_id_created_at_idx" ON "subscription_checkouts"("tenant_id", "created_at");

ALTER TABLE "subscription_checkouts" ADD CONSTRAINT "subscription_checkouts_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscription_checkouts" ADD CONSTRAINT "subscription_checkouts_subscription_id_fkey"
    FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
