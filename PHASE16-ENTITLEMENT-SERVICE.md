# Phase 16 — Entitlement Service (2026-08-30)

Scope per roadmap: centralize plan-limit checks (outlets, users, POS
devices) and feature-flag checks into one reusable service. No HTTP
endpoints (Phase 17), no actual blocking of over-limit actions (Phase 23 —
that's a separate product decision about what a refused create should look
like to the client).

## What changed

- `backend/src/entitlements/entitlements.service.ts` (new) — `EntitlementsService`
  - `getPlanLimits(tenantId)` — resolves `maxOutlets` / `maxUsers` /
    `maxPosDevices` / `features` from the plan tied to the tenant's current
    subscription. Reuses `SubscriptionsService.getCurrent()` for "which
    subscription is current" rather than re-querying it, so that stays
    defined in one place. Deliberately does **not** gate on subscription
    status (TRIALING/ACTIVE/PAST_DUE/...) — a lapsed subscription still has
    a plan on file, and "does this tenant's plan allow X" is a different
    question from "is this tenant currently entitled to use the product",
    which stays on `SubscriptionsService.isActive()`.
  - `checkOutletLimit` / `checkUserLimit` / `checkPosDeviceLimit(tenantId)`
    — each returns `{ resource, allowed, current, limit, remaining }`.
    `allowed` means "can add one more unit of this resource right now".
    `limit <= 0` is treated as unlimited (`remaining: Infinity`). Being at
    or over the limit clamps `remaining` to `0` rather than going negative
    (covers a plan downgrade leaving a tenant over its new limit).
  - `isFeatureEnabled(tenantId, featureKey)` — reads `plan.features`
    (a `Json` map); an unknown/unlisted key defaults to `false` so a typo
    or a newly-added feature flag never silently unlocks for every
    existing plan.
  - `getUsageSummary(tenantId)` — all three resource checks plus the
    feature map in one call; the shape Phase 17's "plan limits" API is
    expected to expose.
  - Outlet/user counts filter on `status: 'ACTIVE'`
    (`OutletStatus`/`UserStatus`), matching how those statuses are used
    elsewhere in the codebase.
  - **POS device count has no dedicated registry to read** — there is no
    `PosDevice` model in the schema. It counts distinct
    `PosSession.deviceId` values ever seen for the tenant as the closest
    available proxy. Flagging this rather than quietly baking it in, same
    as the open items the Phase 13 audit left behind: a tenant that retires
    a physical device keeps counting it forever (its `deviceId` never
    leaves session history), and a freshly provisioned device that hasn't
    opened a session yet doesn't count at all. Worth a real fix if/when a
    device-registration flow gets built (candidate spot: Phase 18
    onboarding or Phase 25 POS idempotency) — not attempted here since that
    would mean adding a new model, out of scope for "centralize plan
    limits."
- `backend/src/entitlements/entitlements.module.ts` (new) — imports
  `SubscriptionsModule`, exports `EntitlementsService`. No controller yet.
- `backend/src/app.module.ts` — registered `EntitlementsModule`.
- `backend/src/entitlements/entitlements.service.spec.ts` (new) — 14 tests:
  limits resolution (including missing-subscription and
  missing/null-features edge cases), each resource check under/at/over/
  unlimited, the POS distinct-device-id query shape, feature-flag
  true/false/unknown-key behavior, and the bundled usage summary.

## Test/build results (run in this sandbox)

```
cd backend && npm install
npx tsc --noEmit -p tsconfig.json   # error set identical to pre-existing baseline
                                     # (diffed byte-for-byte against a baseline run
                                     # taken before touching anything this phase —
                                     # 21 pre-existing errors, 0 new)
npx jest src/entitlements           # 14/14 passing
npx jest                            # 104/109 passing — same 5 pre-existing failures
                                     # as Phase 15 (push.service.spec.ts,
                                     # health.controller.spec.ts, ioredis-mock issue),
                                     # untouched by this phase; 14 new tests, all green
```

No Prisma schema or migration changes this phase — `SubscriptionPlan`
already carries `maxOutlets`/`maxUsers`/`maxPosDevices`/`features` from
Phase 14, and this service only reads them.

## Do not build yet (per roadmap)

- Any HTTP endpoint exposing these checks — Phase 17.
- Actually stopping an outlet/user/device creation or WhatsApp-feature call
  when a limit check fails — Phase 23 (Subscription Enforcement). This
  phase only answers the question; wiring the answer into every
  create/invite flow, and deciding what error shape the client sees, is a
  separate pass.
- A `PosDevice` registry model — noted above as a real gap, not fixed here.

## Next phase

**Phase 17 — Subscription API**: expose current-subscription, current-plan,
plan-limits (`EntitlementsService.getUsageSummary()`), and available-plans
endpoints, each scoped so a company can only see its own data.
