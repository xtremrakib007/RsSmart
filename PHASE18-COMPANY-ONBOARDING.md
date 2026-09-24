# Phase 18 — Company Onboarding (2026-08-30)

Scope per roadmap: a fresh signup should end up with a trial subscription,
without manual DB work, via a safe server-side workflow.

This phase's three files (`auth.service.ts`, `auth.module.ts`,
`auth.service.spec.ts`) were built and reviewed in a separate session and
are integrated into this codebase drop as-is. Documented here for the
record, and because Phase 19 (Employee Invitation) builds directly on top
of `auth.service.ts`.

## What changed

- `backend/src/auth/auth.service.ts`
  - `registerCompany()` already did signup → company → owner → first outlet
    atomically (Phase 12). Added the missing last step: a trial subscription
    via `SubscriptionsService.createTrial()` (Phase 15), called **after**
    that transaction commits — not inside it, since `createTrial()` isn't
    written to accept a transaction client and changing Phase 15's
    already-shipped service was out of scope for this phase.
  - Which plan a signup lands on is `DEFAULT_TRIAL_PLAN_SLUG` (env, default
    `'starter'`), resolved server-side from a slug — never a raw plan id
    (ids are per-database UUIDs) and never client-suppliable.
  - A plan-lookup or `createTrial()` failure is caught and audit-logged
    (`SUBSCRIPTION_TRIAL_START_FAILED`) rather than failing the signup — the
    company/owner already committed are real and can't be undone here.
    Recovery is a clean retry later via `createTrial()`'s own existing
    live-subscription guard.
- `backend/src/auth/auth.module.ts` — imports `SubscriptionsModule` so
  `SubscriptionsService` can be injected into `AuthService`.
- `backend/src/auth/auth.service.spec.ts` — 3 new tests: trial started on
  successful signup, signup still succeeds and audits when the plan slug
  matches nothing, signup still succeeds and audits when `createTrial()`
  itself throws.

## Known gap, deliberately not fixed

No `SubscriptionPlan` row currently exists with the `'starter'` slug (or
any slug) in this codebase's seed data, so every signup hits the
logged-failure path until an operator seeds a matching plan. This needs
seed/plan data and a product decision (which plan, what limits), not a code
change — flagged in `.env.example`, not papered over.

## Sandbox limitation

No live Postgres/Prisma engine was reachable from the build sandbox
(`binaries.prisma.sh` unreachable, no network egress). Tests are written
against mocked `PrismaService`/`SubscriptionsService`/`AuditService` and
were reviewed but not executed against a real Jest run in this drop — run
`npm test` for real before trusting this beyond dev, same caveat as every
prior phase in this roadmap.
