# Phase 14 — Subscription Plan Models (2026-08-30)

Scope per roadmap: **database foundation only**. No subscription service, no
API, no payment gateway, no checkout, no billing UI — those are Phase
15/17/20/21/22. This pass adds exactly two tables plus the accompanying
Prisma models.

## What changed

- `backend/prisma/schema.prisma`
  - New model `SubscriptionPlan` — global catalog (not tenant-scoped; every
    company chooses from the same plan list). Holds `priceMonthly`,
    `currency`, the three Phase 16 entitlement limits (`maxOutlets`,
    `maxUsers`, `maxPosDevices`), a `features` JSON blob for feature
    toggles, `isActive`/`sortOrder` for admin management, and timestamps.
  - New model `Subscription` — tenant-scoped, FKs to both `Tenant`
    (`onDelete: Cascade`) and `SubscriptionPlan` (`onDelete: Restrict`, so a
    plan can't be deleted out from under an existing subscription). New enum
    `SubscriptionStatus` (`TRIALING`, `ACTIVE`, `PAST_DUE`, `SUSPENDED`,
    `CANCELLED`, `EXPIRED`) covers the lifecycle Phase 15 will implement.
  - Added `subscriptions Subscription[]` to `Tenant`'s relation list.
- `backend/prisma/migrations/20260830100000_phase14_subscription_plans/migration.sql`
  — hand-written, additive-only (new tables + new enum; nothing existing
  touched, nothing dropped, no data rewritten).

## Design choices worth flagging

- **`Subscription` is one-to-many per tenant, not one-to-one.** Each
  plan change/renewal is a new row rather than an in-place overwrite, so
  history isn't lost. "Current subscription" (most recent row, or the one
  with an active-ish status) is left for Phase 15's service layer to define
  and query — this migration doesn't add a `current` flag or a unique
  constraint forcing exactly one active row per tenant, since that's a
  product/logic decision, not a schema one.
- **`SubscriptionPlan` has no `tenantId`.** It's a shared catalog table,
  matching how the roadmap phrases it ("Available plans API" in Phase 17
  implies one shared list, not one per company).
- Left alone, per PHASE13_AUDIT.md's explicit "revisit later" list:
  idempotency scope for billing operations, and cancellation/offboarding
  semantics (soft-delete vs. cascade). Neither is touched by this migration.

## Before you trust this beyond dev/staging

**No live PostgreSQL or Prisma engine binary was reachable from this build
sandbox** (`binaries.prisma.sh` returns 403 here — same limitation noted in
the Phase 11/12 and Phase 13 passes). `npx prisma validate` was attempted and
failed only on the network fetch, not on schema content. What *was* checked
by hand:
- No duplicate model/enum names anywhere in `schema.prisma`.
- Brace-balance of the whole file (63/63).
- Every new relation field has a matching back-reference (`Tenant.subscriptions`
  ↔ `Subscription.tenant`, `SubscriptionPlan.subscriptions` ↔
  `Subscription.plan`) — the exact class of bug Phase 13's audit caught
  elsewhere in this schema.
- `Decimal(12, 2)` for `priceMonthly` matches every other money column in
  the schema (`basePrice`, `total`, `creditLimit`, etc. all use the same
  precision/scale).

Still required before this ships anywhere real:
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy   # or `migrate dev` locally against a scratch DB
```

## Do not build yet (per roadmap)

- Subscription lifecycle logic (create trial / activate / cancel / suspend /
  expire) — Phase 15.
- Entitlement/limit-checking service — Phase 16.
- Any API endpoint exposing plans or subscriptions — Phase 17.
- Payment provider integration — Phase 20/21.

## Next phase

**Phase 15 — Subscription Service**: implement the lifecycle operations
listed above on top of these two tables. Nothing else in the codebase
(services, controllers, seed data) was touched in this pass.
