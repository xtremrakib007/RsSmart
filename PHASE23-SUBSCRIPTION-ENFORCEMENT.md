# Phase 23 — Subscription Enforcement (2026-08-30)

## Goal
Actually enforce plan limits. Resources cannot exceed plan limits.

## What changed

- `src/common/exceptions/plan-limit.exception.ts` — New reusable HTTP 403
  exception with structured body `{ resource, current, limit }` so the
  client can distinguish plan limits from other authz failures.

- `src/outlets/outlets.service.ts` — Injects `EntitlementsService`, calls
  `checkOutletLimit()` before `create()`. Rejects with
  `PlanLimitExceededException` when `allowed === false`.

- `src/outlets/outlets.module.ts` — Imports `EntitlementsModule`.

- `src/auth/auth.service.ts` — Injects `EntitlementsService`, calls
  `checkUserLimit()` at the top of `inviteUser()`. Same exception shape.

- `src/auth/auth.module.ts` — Imports `EntitlementsModule`.

- `src/invitations/invitations.service.ts` — Injects `EntitlementsService`,
  calls `checkUserLimit()` at the top of `accept()`. Same exception shape.

- `src/invitations/invitations.module.ts` — Imports `EntitlementsModule`.

- `src/pos-sessions/pos-sessions.service.ts` — Injects `EntitlementsService`,
  calls `checkPosDeviceLimit()` in `openSession()` only when the deviceId
  has never been seen before for this tenant.

- `src/pos-sessions/pos-sessions.module.ts` — Imports `EntitlementsModule`.

## Security
- Every check uses `tenantId` from the verified JWT, matching Phases 15–17.
- No client-supplied limit or count is trusted.
- The exception body does not leak other tenants' data.

## Remaining risks / deferred
- Feature-flag enforcement (`isFeatureEnabled`) is available but not wired
  into any specific feature gates yet — add per-feature as built.
- Subscription status gating (`isActive()`) is not enforced here; a tenant
  with an expired subscription can still query limits but may be blocked
  from creating resources. Add a `SubscriptionsService.isActive()` check
  at the controller level if the product decision is to block everything.
- Sandbox limitation: `prisma generate` / `migrate deploy` / `npm test` /
  `npm run build` need to run for real in a live environment.
