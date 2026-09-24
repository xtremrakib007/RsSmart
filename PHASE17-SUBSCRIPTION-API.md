# Phase 17 — Subscription API (2026-08-30)

Scope per roadmap: expose plans/subscription safely — current subscription,
current plan, plan limits, available plans. Read-only. Security requirement:
a company can only see its own subscription.

## What changed

- `backend/src/subscriptions/subscriptions.service.ts`
  - Added `getCurrentPlan(tenantId)` — the full plan record (name, price,
    description, limits, features) behind the tenant's current subscription.
  - Added `listAvailablePlans()` — active plans (`isActive: true`), ordered
    by `sortOrder`. Not tenant-scoped — the plan catalog is global data, not
    per-tenant, so there's nothing to leak across companies here.
  - **Bug avoided, not introduced:** the existing private `getPlanOrThrow()`
    (used by `createTrial`) rejects a retired (`isActive: false`) plan —
    correct when a tenant is *about to be put on* a plan, wrong when a
    tenant is *already on* one. A tenant validly keeps using a plan after
    it's retired from new sign-ups (grandfathering) and must still be able
    to see it. Split the lookup into a bare `getPlanById()` (existence check
    only) and `getPlanOrThrow()` (adds the active check on top of it);
    `getCurrentPlan()` uses the bare version, `createTrial()` still uses the
    active-checked one, unchanged behavior. Caught by writing the "tenant on
    a since-retired plan can still view it" test before wiring the
    controller — worth calling out since it would have been an easy one to
    miss by reusing `getPlanOrThrow()` directly.
  - Added a local `SubscriptionPlanRecord` type (same sandbox-typing
    workaround as the existing `SubscriptionRecord` — see the Phase 15 note
    on `@prisma/client` types not being generated here).
- `backend/src/subscriptions/subscriptions.controller.ts` (new) —
  `@Controller('subscriptions')`: `GET /current`, `GET /current/plan`,
  `GET /plans`. No `@RequirePermissions` on any of these, matching
  `OutletsController`'s `list()`/`get()` — any authenticated user of the
  tenant can view their own company's subscription. `tenantId` always comes
  from `@CurrentUser()` (the verified JWT), never a route param or request
  body, so there's no cross-tenant lookup vector to guard against.
- `backend/src/entitlements/entitlements.controller.ts` (new) — also
  `@Controller('subscriptions')`, one route: `GET /limits`, backed by
  `EntitlementsService.getUsageSummary()`. **Declared in `EntitlementsModule`,
  not `SubscriptionsModule`** — `EntitlementsModule` already imports
  `SubscriptionsModule` for `EntitlementsService`'s own use (Phase 16); if
  `SubscriptionsModule` imported `EntitlementsModule` back to get its
  controller a copy of `EntitlementsService`, that's a circular module
  dependency. Splitting the controller into whichever module already has
  the provider it needs avoids that with no `forwardRef()` gymnastics.
  Both controllers share the `subscriptions` route prefix with no path
  collisions (`current`, `current/plan`, `plans`, `limits`), so this is
  invisible to API callers — it's a backend file-organization detail only.
- `backend/src/subscriptions/subscriptions.module.ts` /
  `backend/src/entitlements/entitlements.module.ts` — each gained a
  `controllers: [...]` entry; no other providers/imports/exports changed.
- `backend/src/subscriptions/subscriptions.service.spec.ts` — 5 new tests
  for `getCurrentPlan`/`listAvailablePlans`, including the
  retired-plan-still-visible case above.
- `backend/src/subscriptions/subscriptions.controller.spec.ts` (new) and
  `backend/src/entitlements/entitlements.controller.spec.ts` (new) — the
  "authorization tests" the roadmap's Done criterion calls for. Plain
  instantiation with a mocked service (`new XController(mockService)`),
  matching this codebase's existing service-spec style, rather than
  bootstrapping a full Nest `TestingModule` — the one existing
  `*.controller.spec.ts` in this repo (`health.controller.spec.ts`) does
  the latter and is one of the two suites broken by an unrelated
  ioredis-mock issue in this sandbox; plain instantiation sidesteps that
  entirely. Each test asserts the service is called with the tenant id
  taken from `@CurrentUser()`, and that a second caller's tenant id is
  never mixed up with the first's — the concrete form "a company can only
  see its own subscription" takes here, since `tenantId` never comes from
  client input in the first place.

## Test/build results (run in this sandbox)

```
cd backend && npm install
npx tsc --noEmit -p tsconfig.json   # error set identical to the pre-existing
                                     # baseline (diffed byte-for-byte) — 0 new errors
npx jest src/subscriptions src/entitlements   # 49/49 passing
npx jest                                      # 115/120 passing — same 5 pre-existing
                                               # failures as Phase 15/16
                                               # (push.service.spec.ts,
                                               # health.controller.spec.ts,
                                               # ioredis-mock issue), untouched;
                                               # 25 new tests this phase, all green
```

No Prisma schema or migration changes this phase.

## Do not build yet (per roadmap)

- No mutation endpoints (activate/cancel/suspend) exposed via HTTP —
  `SubscriptionsService` already has the logic (Phase 15) but wiring it up
  safely (who's allowed to cancel their own subscription, how a checkout
  success reaches `activate()`) belongs to Phase 20/21, not this phase.
- Nothing here blocks an over-limit action — `EntitlementsService`
  (Phase 16) answers "is this allowed", Phase 23 is what acts on the
  answer.
- `GET /subscriptions/plans` is left behind the standard auth guard, not
  made `@Public()`. If Phase 18's onboarding flow needs to show plans to a
  user who isn't authenticated yet (picking a plan before a company/JWT
  exists), that's a deliberate call for that phase to make — not assumed
  here.

## Next phase

**Phase 18 — Company Onboarding**: signup → company → owner → first outlet
→ trial subscription, as a single safe server-side transaction. Will likely
call `SubscriptionsService.createTrial()` directly (already built, Phase
15) rather than through this phase's read-only API. Also where the
"should plan listing be public pre-signup" question above gets decided,
if it comes up.
