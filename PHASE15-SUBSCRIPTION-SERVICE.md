# Phase 15 — Subscription Service (2026-08-30)

Scope per roadmap: subscription **lifecycle logic only** — create trial, get
current, activate, cancel, suspend, expire, basic status checks. No payment
integration, no usage billing, no HTTP endpoints (Phase 17 adds those on top
of this service).

## What changed

- `backend/src/subscriptions/subscriptions.service.ts` (new)
  - `createTrial(tenantId, planId, actorUserId, trialDays = 14)` — creates a
    new `Subscription` row in `TRIALING`. Refuses if the tenant already has a
    "live" subscription (`TRIALING`/`ACTIVE`/`PAST_DUE`/`SUSPENDED`) so a
    tenant can't stack two trials; refuses an unknown or retired
    (`isActive: false`) plan.
  - `getCurrent(tenantId)` — returns the tenant's most recent subscription
    row, or `NotFoundException` if they've never had one.
  - `activate` / `cancel` / `suspend` / `expire` — status transitions, each
    scoped to the owning tenant (a cross-tenant `subscriptionId` resolves to
    `NotFoundException`, same pattern as `OutletsService.get`). Every
    transition is checked against an explicit allow-list
    (`SubscriptionsService.TRANSITIONS`) rather than scattered `if`s, so a
    disallowed move (e.g. reactivating a `CANCELLED` subscription) is
    refused with a clear `BadRequestException` instead of silently
    corrupting state. Calling a transition method when the subscription is
    already in the target status is a true no-op (returns the existing row,
    no DB write, no audit entry) rather than either erroring or writing a
    redundant update.
  - `cancel(..., { atPeriodEnd })` defaults to `true`: it only sets
    `cancelAtPeriodEnd`, leaving the tenant with access through
    `currentPeriodEnd`; actually reaching `CANCELLED` status happens via a
    later `expire`/scheduled job. `{ atPeriodEnd: false }` cancels
    immediately.
  - `isActive(tenantId)` / `getStatus(tenantId)` — the "basic status checks"
    the roadmap calls for. `isActive` treats `TRIALING`/`ACTIVE` as good
    standing but additionally checks the period/trial end date against
    `Date.now()`, so a subscription whose period has already lapsed reads as
    inactive even before a sweep job flips its status column — safe to call
    from request-time authorization once Phase 16 wires it in.
  - Every mutation writes an `AuditLog` entry (`SUBSCRIPTION_TRIAL_STARTED`,
    `SUBSCRIPTION_ACTIVATED`, `SUBSCRIPTION_CANCEL_SCHEDULED`,
    `SUBSCRIPTION_CANCELLED`, `SUBSCRIPTION_SUSPENDED`,
    `SUBSCRIPTION_EXPIRED`), matching the existing `OutletsService`/
    `TenantsService` pattern.
- `backend/src/subscriptions/subscriptions.module.ts` (new) — service only,
  exported for Phase 16 (entitlements) and Phase 17 (API) to consume. No
  controller yet.
- `backend/src/app.module.ts` — registered `SubscriptionsModule`.
- `backend/src/subscriptions/subscriptions.service.spec.ts` (new) — 24
  tests covering: tenant isolation on lookups, the live-subscription guard on
  `createTrial`, every allowed and several disallowed status transitions,
  idempotency of same-status calls, and the `isActive`/`getStatus` period
  math (including a subscription whose period already lapsed).

## A note on typing (sandbox limitation, not a design choice)

`SubscriptionStatus` and the subscription record shape are defined locally
in `subscriptions.service.ts` instead of imported from `@prisma/client`.
This sandbox still has no network access to `binaries.prisma.sh` (same
limitation noted in every prior phase's notes), so `prisma generate` can't
produce model types for `SubscriptionPlan`/`Subscription` — importing them
would make this module fail to compile *and* fail to test here, unlike
`whatsapp-campaign.service.ts`, which already has this exact problem
pre-existing in this codebase (confirmed via a baseline `tsc --noEmit`
before touching anything). The string values are identical to the schema
enum; swap the import back to `@prisma/client` once `prisma generate` has
actually run against this schema in an environment with real network
access.

## Test/build results (run in this sandbox)

```
cd backend && npm install
npx tsc --noEmit -p tsconfig.json   # no NEW errors introduced by this phase
                                     # (pre-existing errors: missing @nestjs/config,
                                     # ioredis, i18next, etc. — all present before this change)
npx jest src/subscriptions          # 24/24 passing
npx jest                            # 90/95 passing — the 5 failures are in
                                     # push.service.spec.ts and health.controller.spec.ts,
                                     # both pre-existing (ioredis mock issue), untouched by this phase
```

`npx prisma generate` / `migrate deploy` still need to be run for real,
outside this sandbox, before any of this touches staging — same standing
note as every migration in this project so far.

## Do not build yet (per roadmap)

- Entitlement/limit-checking on top of `SubscriptionPlan.maxOutlets` etc. —
  Phase 16.
- Any HTTP endpoint — Phase 17.
- Payment provider integration, webhook-driven activation — Phase 20/21.
- A scheduled job to actually call `expire()` when a period lapses — not
  named in Phase 15, left for whichever later phase adds background jobs.

## Next phase

**Phase 16 — Entitlement Service**: build the reusable service that reads
`SubscriptionPlan.maxOutlets`/`maxUsers`/`maxPosDevices`/`features` (via
`SubscriptionsService.getCurrent()`) and answers "is this tenant within
limits / does this tenant have feature X enabled". Nothing else in the
codebase was touched in this pass.
