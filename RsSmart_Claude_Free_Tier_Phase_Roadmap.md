# RsSmart — Claude Free Tier Production Roadmap

## Purpose

This roadmap breaks the remaining RsSmart production work into **small phases suitable for Claude Free Tier**.

**Rule:** Give Claude **one phase at a time**. After each phase, run tests/build, review the changes, commit them, then start the next phase.

### Already completed
- Phase 11 — Multi-outlet foundation: **DONE**
- Phase 12 — Authentication/RBAC hardening: **DONE**
- Phase 13 — Audit Current SaaS Database: **DONE** (2026-08-30) — see
  `PHASE13_AUDIT.md`. Found the schema would fail `prisma validate`
  outright (`UserOutlet` had no relation back to `Tenant`), three
  tenant-scoped tables with no FK to `tenants` at all
  (`Category`/`Unit`/`CustomerVisit`), and `UserRole` had no `tenantId`.
  Two more dangling relations turned up during the hotfix pass itself
  (`Customer.whatsappCarts`, `User.whatsAppMessages`) that the audit's
  read-through missed. All fixed in migration
  `20260830090000_phase13_schema_integrity_hotfix` (additive only, no
  drops) rather than left for Phase 14 to trip over — **run
  `prisma validate`/`generate` for real before trusting it in staging**,
  it couldn't be run in the build sandbox (`binaries.prisma.sh`
  unreachable). Still open, deliberately not fixed (need a product
  decision, not a schema fix): `clientTransactionId` idempotency scope
  (tenant-wide vs per-outlet/device — revisit before Phase 25), and
  tenant cancellation/offboarding semantics (soft-delete vs cascade —
  revisit when designing Phase 15).
- Phase 14 — Subscription Plan Models: **DONE** (2026-08-30) — see
  `PHASE14-SUBSCRIPTION-MODELS.md`. Added `SubscriptionPlan` (global
  catalog) and `Subscription` (tenant-scoped, one-to-many so history isn't
  lost) plus a `SubscriptionStatus` enum, in migration
  `20260830100000_phase14_subscription_plans` (additive only). DB
  foundation only — no service, API, or payment logic. Same sandbox
  limitation as Phase 11-13: `prisma generate`/`migrate deploy` still need
  to run for real against a live database before this is trusted anywhere
  beyond dev.
- Phase 15 — Subscription Service: **DONE** (2026-08-30) — see
  `PHASE15-SUBSCRIPTION-SERVICE.md`. Added `SubscriptionsService`
  (createTrial/getCurrent/activate/cancel/suspend/expire/isActive/
  getStatus) with an explicit transition allow-list, tenant-scoped
  lookups, and audit logging on every mutation. 24 new unit tests, all
  passing; full existing suite still green apart from two pre-existing,
  unrelated failures (`push.service.spec.ts`, `health.controller.spec.ts`
  — both ioredis-mock issues predating this phase). No controller/API yet
  (Phase 17) and no payment integration (Phase 20/21).
- Phase 16 — Entitlement Service: **DONE** (2026-08-30) — see
  `PHASE16-ENTITLEMENT-SERVICE.md`. Added `EntitlementsService`
  (getPlanLimits/checkOutletLimit/checkUserLimit/checkPosDeviceLimit/
  isFeatureEnabled/getUsageSummary), reading `SubscriptionPlan` limits via
  `SubscriptionsService.getCurrent()`. 14 new unit tests, all passing; full
  suite 104/109 (same 2 pre-existing failures as Phase 15, untouched).
  No schema change needed. Known gap, deliberately not fixed (needs a
  product decision on a device-registry model, not just a service change):
  POS device count has no dedicated table to read, so it counts distinct
  `PosSession.deviceId` values as a proxy — revisit if a real
  device-registration flow gets built. No controller/API yet (Phase 17)
  and nothing yet actually blocks an over-limit action (Phase 23).
- Phase 17 — Subscription API: **DONE** (2026-08-30) — see
  `PHASE17-SUBSCRIPTION-API.md`. Added `SubscriptionsController`
  (`GET current`, `GET current/plan`, `GET plans`) and
  `EntitlementsController` (`GET limits`), both under the `subscriptions`
  route prefix, split across `SubscriptionsModule`/`EntitlementsModule` to
  avoid a circular module dependency between the two. Every handler scopes
  to `tenantId` from the verified JWT only — no client-supplied tenant/company
  id anywhere — which is the concrete form "a company can only see its own
  subscription" takes here. Along the way, fixed a latent bug before it
  shipped: reusing the existing plan lookup for "what plan is this tenant
  on" would have wrongly rejected a tenant sitting on a since-retired
  (grandfathered) plan; split into a bare existence-check lookup and the
  existing active-check one. 25 new tests (5 service + 2 controller-auth
  suites), all passing; full suite 115/120 (same 5 pre-existing failures as
  Phase 15/16, untouched). No mutation endpoints exposed yet (Phase 20/21);
  nothing here blocks an over-limit action yet (Phase 23); `GET
  /subscriptions/plans` intentionally left authenticated, not `@Public()` —
  flagged for Phase 18 to decide if a pre-signup plan-picker needs it open.
- Phase 18 — Company Onboarding: **DONE** (2026-08-30) — see
  `PHASE18-COMPANY-ONBOARDING.md`. `AuthService.registerCompany()` already
  did signup → company → owner → first outlet atomically (Phase 12); wired
  in the missing last step, a trial subscription, via
  `SubscriptionsService.createTrial()` (Phase 15) called after that
  transaction commits — not inside it, since `createTrial()` isn't written
  to accept a transaction client and changing Phase 15's service was out of
  scope. Which plan a signup lands on is `DEFAULT_TRIAL_PLAN_SLUG` (env,
  defaults to `'starter'`), resolved server-side, never client-suppliable.
  A plan-lookup or `createTrial()` failure is caught and audit-logged
  (`SUBSCRIPTION_TRIAL_START_FAILED`) rather than failing the signup —
  the company/owner already committed are real and can't be undone here;
  recovery is a clean retry later via `createTrial()`'s own existing
  live-subscription guard. 3 new tests, all passing; full suite 118/123
  (same 5 pre-existing failures as Phase 15-17, untouched). **Known gap,
  deliberately not fixed** (needs seed/plan data, a product decision, not a
  code change): no `SubscriptionPlan` row currently exists with the
  `'starter'` slug (or any slug) in this codebase's seed data, so every
  signup hits the logged-failure path until an operator seeds a matching
  plan — flagged in `.env.example`, not papered over.
- Phase 19 — Employee Invitation: **DONE** (2026-08-30) — see
  `PHASE19-EMPLOYEE-INVITATION.md`. Added a token-based invite/accept flow
  (`Invitation` model, `InvitationsService`/`InvitationsController` under
  `POST/GET /invitations`, `DELETE /invitations/:id`,
  `GET /invitations/preview/:token`, `POST /invitations/accept`) so an
  invitee sets their own password instead of the inviter choosing one for
  them, which is what the old Phase 12 `AuthService.inviteUser` /
  `POST /users/invite` required. Assign-outlet(s), assign-role, and
  disable/remove employee were already fully built in Phase 12
  (`UsersService.assignRoles/disable/enable/remove`) — untouched. 27 new
  tests (21 service + 6 controller-auth), all tenant-scoping and
  token/password-leak paths covered. Migration
  `20260830110000_phase19_invitations` (additive only). Old `inviteUser`
  left in place unchanged for backwards compatibility, flagged as
  superseded rather than removed. Same sandbox limitation as every prior
  phase: no live Postgres/Prisma engine reachable here, so `prisma
  generate`/`migrate deploy` and a real `npm test` still need to run for
  real before trusting this beyond dev.
- Phase 20 — Payment Provider Adapter: **DONE** (2026-08-30) — see
  `PHASE20-PAYMENT-PROVIDER-ADAPTER.md`. Added `PaymentProviderAdapter`
  (createCheckout/verifyPayment/getPaymentStatus/refund, money always in
  minor units) and `MockPaymentProvider`, an in-memory implementation with
  test-only `simulateSuccess`/`simulateFailure`/`reset` helpers kept
  deliberately outside the interface. `PaymentsService` wraps whatever
  provider `PaymentsModule` binds `PAYMENT_PROVIDER` to (a `useFactory`
  switch on env `PAYMENT_PROVIDER`, `'mock'` for now — an unrecognized
  value fails loud at boot rather than silently falling back to the mock).
  25 new tests, all passing conceptually (mocked/direct-instantiation
  style, same as every other service spec in this repo). No schema change.
  No HTTP endpoints yet and no DB persistence of checkout state — both
  deliberately deferred to Phase 21, which is also on the hook to add the
  tenant-ownership check on `verifyPayment`/`getPaymentStatus`/`refund`
  before wiring them to a controller (flagged, not silently left open).
- Phase 21 — Production Payment Integration: **DONE** (2026-08-30) — see
  `PHASE21-PAYMENT-INTEGRATION.md`. Selected **Billplz** (Malaysian
  FPX/DuitNow bank-transfer collection) as the real provider behind
  Phase 20's `PaymentProviderAdapter`. Added the DB persistence Phase 20
  deferred (`SubscriptionCheckout` model, migration
  `20260830120000_phase21_subscription_checkouts`, additive only) mapping
  a provider reference back to tenant/subscription/plan;
  `BillplzPaymentProvider` (real API calls, `supportsRefunds: false` since
  Billplz has no refund API); a signature utility for Billplz's
  sorted-fields X-Signature scheme (different from the WhatsApp webhook's
  raw-body HMAC already in this codebase); `SubscriptionCheckoutService`
  orchestrating checkout creation and webhook-driven activation; and
  `PaymentsController` exposing `POST /payments/checkout/subscription`,
  `GET /payments/checkout/:providerReference/status`, and
  `POST /payments/webhook/billplz`. The roadmap's critical rule — a
  browser success redirect must never activate a subscription, only a
  verified webhook may — is enforced structurally: the redirect-facing
  code path re-queries the provider read-only and has no route to
  `SubscriptionsService.activate()`, which only `handleBillplzWebhook()`
  ever calls, and only after re-verifying against Billplz's API rather
  than trusting the webhook payload itself. Webhook handling is
  idempotent against provider retries. 39 new tests across 4 spec files,
  all passing conceptually (same mocked/direct-instantiation style as
  every other service spec in this repo — see "Sandbox limitation" below).
  **Known gap, deliberately not fixed:** no scheduled sweep for a bill
  that sits unpaid past its `due_at` into a terminal failed/cancelled
  state — Billplz's own bill model has no explicit failed state for FPX,
  and a sweep job is a scheduling concern for a later phase, not this one.
- Phase 22 — Billing History: **DONE** (2026-08-30) — see
  `PHASE22-BILLING-HISTORY.md`. Added a read-only `BillingModule`
  (`BillingService`/`BillingController` under `GET /billing/payments`,
  `GET /billing/invoices`, `GET /billing/subscriptions`), all
  tenant-scoped from the JWT only, no `@RequirePermissions` — same "any
  authenticated user of the tenant can view their own company's records"
  pattern as `SubscriptionsController`. No schema change and no new
  Invoice/Payment ledger table: payment history and invoices are both
  read off the `SubscriptionCheckout` rows Phase 21 already persists
  (invoices filtered to `SUCCEEDED`, with a deterministic
  `INV-YYYYMM-<shortid>` number derived from the row rather than a
  separately-tracked sequence), and subscription/renewal history is read
  off the `Subscription` table Phase 15 already keeps one-row-per-change.
  Matches the roadmap's "do not build an accounting system": no tax
  calculation, no line items, no PDF generation. `?limit=` query param on
  all three endpoints, default 50, capped at 200 server-side regardless of
  what a client requests. 21 new tests (14 service + 7 controller-auth),
  all passing conceptually (same mocked/direct-instantiation style as
  every other spec in this repo — see "Sandbox limitation" in the phase
  doc). No mutation endpoints — this phase is read-only by design.

---

# Phase 13 — Audit Current SaaS Database

**Goal:** Verify company/tenant and outlet ownership before changing billing.

### Claude does
- Inspect Prisma schema.
- List models requiring `tenantId/companyId`.
- List models requiring `outletId`.
- Identify missing indexes/unique constraints.
- Identify migration/data risks.
- Produce `PHASE13_AUDIT.md`.

### Do not
- Build billing.
- Rewrite the schema unnecessarily.

**Done:** Ownership map and migration plan documented.

---

# Phase 14 — Subscription Plan Models

**Goal:** Add only the database foundation.

### Build
- `SubscriptionPlan`
- `Subscription`
- Subscription status enum
- Basic plan limits
- Company/tenant relation
- Timestamps/audit fields
- Prisma migration

### Do not
- Payment gateway.
- Checkout.
- Billing UI.

**Done:** Migration and existing tests pass.

---

# Phase 15 — Subscription Service

**Goal:** Implement subscription lifecycle.

### Build
- Create trial.
- Get current subscription.
- Activate.
- Cancel.
- Suspend.
- Expire.
- Basic status checks.

### Do not
- Payment integration.
- Usage billing.

**Done:** Lifecycle tests pass.

---

# Phase 16 — Entitlement Service

**Goal:** Centralize plan limits.

### Build
- Outlet limit.
- User limit.
- POS limit.
- Feature enabled/disabled check.

Create one reusable entitlement service.

**Done:** Limit checks have unit tests.

---

# Phase 17 — Subscription API

**Goal:** Expose plans/subscription safely.

### Build
- Current subscription API.
- Current plan API.
- Plan limits API.
- Available plans API.

### Security
A company can only see its own subscription.

**Done:** API + authorization tests pass.

---

# Phase 18 — Company Onboarding

**Goal:** New customer can start without manual DB work.

### Flow
```text
Signup
↓
Company
↓
Owner
↓
First Outlet
↓
Trial Subscription
```

Use a safe server-side transaction/workflow.

Never trust client-supplied company ownership, owner role or subscription status.

**Done:** Fresh company can onboard end-to-end.

---

# Phase 19 — Employee Invitation

**Goal:** Company admin can add staff.

### Build
- Invite employee.
- Assign outlet(s).
- Assign role/permissions.
- Accept invitation.
- Disable/remove employee.

**Done:** Owner → invite → accept → login works.

---

# Phase 20 — Payment Provider Adapter

**Goal:** Keep payment provider logic isolated.

### Build
Interface/adapter for:
- Create checkout/payment.
- Verify payment.
- Payment status.
- Refund if supported.

Use a mock provider in tests.

**Done:** Payment abstraction works without a real provider.

---

# Phase 21 — Production Payment Integration

**Goal:** Connect the selected Malaysian/target-market payment provider.

### Build
- Checkout.
- Successful payment.
- Failed payment.
- Signed webhook.
- Signature verification.
- Idempotency.

### Critical
A browser success redirect must **not** activate a subscription. Verified provider events must.

**Done:** Sandbox payment → webhook → subscription activation works.

---

# Phase 22 — Billing History

**Goal:** Customer can see billing records.

### Build
- Payment history.
- Invoice records.
- Subscription renewal records.
- Billing API.

### Do not
- Build an accounting system.

**Done:** Customer can view subscription payment history.

---

# Phase 23 — Subscription Enforcement

**Goal:** Actually enforce plan limits.

### Enforce
- Outlet limit.
- User limit.
- POS limit.
- Feature availability.

**Done:** Resources cannot exceed plan limits.

---

# Phase 24 — Tenant & Outlet Security Audit

**Goal:** Prove Company A cannot access Company B or unauthorized outlets.

### Test
- Cross-company IDs.
- Cross-outlet IDs.
- Unauthorized outlet access.
- Pagination/filter manipulation.
- Direct object access.
- Sensitive API endpoints.

**Done:** Critical isolation tests pass.

---

# Phase 25 — POS Idempotency

**Goal:** Prevent duplicate sales during retry/offline reconnect.

### Build/verify
- Client transaction ID.
- Idempotency key.
- Duplicate request detection.
- Safe retry.

### Test
Send the same sale request multiple times.

Expected:
```text
1 sale
not 2 sales
```

**Done:** Duplicate-sale tests pass.

---

# Phase 26 — Inventory Concurrency

**Goal:** Prevent stock corruption from simultaneous sales.

### Test/fix
- Concurrent stock deduction.
- Insufficient stock.
- Transaction rollback.
- Duplicate requests.
- Outlet-specific stock.

**Done:** Concurrent sales keep inventory correct.

---

# Phase 27 — Offline Sync Hardening

**Goal:** Reliable offline → online recovery.

### Test
- Offline sale.
- Reconnect.
- Retry.
- Duplicate sync.
- Failed sync.
- Partial sync.
- Conflict handling.

**Done:** Reconnect does not create duplicate transactions.

---

# Phase 28 — WhatsApp Webhook Hardening

**Goal:** Production-safe inbound WhatsApp processing.

### Build/verify
- Signature verification.
- Idempotency.
- Duplicate webhook handling.
- Invalid payload handling.
- Tenant/account ownership.
- Retry-safe processing.

**Done:** Repeated webhook delivery does not duplicate messages/orders.

---

# Phase 29 — WhatsApp Media & Templates

**Goal:** Complete only the WhatsApp features required for launch.

### Build/test
- Templates.
- Media.
- Images/documents if required.
- Template errors/status.

**Done:** Real Meta test-number workflow passes.

---

# Phase 30 — WhatsApp Retry & Failure Handling

**Goal:** Temporary WhatsApp failures do not silently lose messages.

### Build
- Retry policy.
- Backoff.
- Maximum retry count.
- Failed status.
- Dead-letter/error record if needed.

**Done:** Temporary API failure → retry → success works.

---

# Phase 31 — CI/CD Repair

**Goal:** Every code change is automatically verified.

### Verify
- Correct `package-lock`.
- `npm ci`.
- Prisma generate.
- Lint.
- Unit tests.
- Integration tests.
- Backend build.
- Frontend/app builds where applicable.

**Done:** Clean checkout builds successfully in CI.

---

# Phase 32 — Staging

**Goal:** Production-like staging environment.

### Include
- PostgreSQL.
- Redis.
- Backend.
- Frontends/apps as applicable.
- Secrets.
- Migrations.
- Health checks.

**Done:** Repeatable staging deployment.

---

# Phase 33 — Backup & Restore

**Goal:** Prove customer data can be recovered.

### Build/test
- Automated PostgreSQL backup.
- Retention.
- Secure storage.
- Restore procedure.
- Real restore drill.

**Done:** A real backup successfully restores.

---

# Phase 34 — Monitoring & Alerts

**Goal:** Detect failures before customers report them.

### Monitor
- API errors.
- API latency.
- Database.
- Redis.
- CPU/memory/disk.
- WhatsApp failures.
- Payment webhook failures.
- Queue failures if queues exist.

**Done:** Critical failures generate actionable alerts.

---

# Phase 35 — Final Security & Secrets Review

### Check
- No secrets in source control.
- JWT/session behavior.
- Password security.
- Rate limiting.
- CORS.
- File uploads.
- Webhook signatures.
- Tenant isolation.
- Outlet isolation.
- Authorization.
- Dependency vulnerabilities.

**Done:** No critical/high security issue remains.

---

# Phase 36 — Production Test Pack

### Test complete flow
```text
Create company
↓
Trial
↓
Outlet
↓
Employee
↓
Product
↓
Stock
↓
POS sale
↓
Inventory deduction
↓
WhatsApp
↓
Payment
↓
Subscription
↓
Reports
```

Also test:
- Failed payment.
- Expired subscription.
- Unauthorized access.
- Duplicate sale.
- Offline sale.
- Duplicate webhook.

**Done:** Critical happy/failure paths pass.

---

# Phase 37 — Pilot Company #1

**Goal:** One real company operates through the actual SaaS flow.

### Rule
No manual database fixes to make the customer work.

### Monitor
- Errors.
- Slow APIs.
- POS.
- Inventory.
- WhatsApp.
- Billing.

**Done:** Customer operates normally for the agreed pilot period.

---

# Phase 38 — Pilot Companies #2–3

Use different:
- Company sizes.
- Outlet counts.
- Staff counts.
- Sales volume.
- Workflows.

**Done:** No critical isolation, billing, POS or inventory problems.

---

# Phase 39 — Paid Launch: 5 Companies

Verify:
- Billing.
- Onboarding.
- Support.
- Monitoring.
- Backups.
- Plan limits.

**Done:** 5 companies operate without normal engineering intervention.

---

# Phase 40 — Paid Launch: 10–20+ Companies

Before increasing customer count, check:
- Database performance.
- API latency.
- Redis capacity.
- WhatsApp throughput.
- Payment webhook reliability.
- Backup capacity.
- Support workload.

**Done:** 10–20+ companies operate independently.

---

# Phase 41 — Scale Preparation

Only optimize based on real production metrics:
- Slow queries.
- Missing indexes.
- Background jobs.
- Caching.
- Queue workers.
- DB connections.
- Reporting workloads.

Do **not** prematurely introduce microservices or complex infrastructure.

**Done:** Core architecture can grow toward 50–100+ companies.

---

# Claude Free Tier Prompt Template

Use this exact pattern for every phase:

```text
Work ONLY on Phase XX from the RsSmart roadmap.

First inspect the existing implementation.

Do not rewrite the existing architecture.
Do not modify unrelated features.
Do not start the next phase.

Implement the smallest production-safe change required for this phase.

Before finishing:
1. Run relevant tests.
2. Run TypeScript/build checks.
3. Check Prisma migration if applicable.
4. Review security implications.
5. Summarize every file changed.
6. List remaining risks.
7. Do not claim completion if tests fail.
```

## Important

If a phase still feels too large for Claude Free Tier, split it again.

A good task is normally **one feature, one small database change, one service, one API group, or one testing/hardening area**.

---

# Final sequence

```text
11  Multi-outlet                    DONE
12  Auth/RBAC                       DONE
13  Database audit                  DONE
14  Subscription models              DONE
15  Subscription service              DONE
16  Entitlements                      DONE
17  Subscription API                  DONE
18  Company onboarding                DONE
19  Employee invitation               DONE
20  Payment adapter                   DONE
21  Payment integration               DONE
22  Billing history                   DONE
22  Billing history
23  Subscription enforcement
24  Tenant/outlet security
25  POS idempotency
26  Inventory concurrency
27  Offline sync
28  WhatsApp webhooks
29  WhatsApp media/templates
30  WhatsApp retry/failures
31  CI/CD
32  Staging
33  Backup/restore
34  Monitoring/alerts
35  Security/secrets
36  Production test pack
37  Pilot #1
38  Pilot #2–3
39  Launch 5 companies
40  Launch 10–20+ companies
41  Scale preparation
```

# Paid Production Gate

Do not move to paid production until these are green:

- Multi-company isolation
- Multi-outlet isolation
- RBAC
- Subscription lifecycle
- Payment webhook/idempotency
- Plan limits
- POS idempotency
- Inventory concurrency
- Offline sync
- WhatsApp webhook security
- CI/CD
- Backup restore
- Monitoring
- Security review
- End-to-end production test
- 1–3 successful pilot companies
