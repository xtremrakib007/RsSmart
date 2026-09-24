# Phase 22 — Billing History (2026-08-30)

Scope per roadmap: customer can see billing records — payment history,
invoice records, subscription renewal records, billing API. Explicitly out
of scope: building an accounting system. Done when a customer can view
their subscription payment history.

## What changed

- `backend/src/billing/billing.service.ts` (new) — `BillingService`, a
  read-only service with three methods, all tenant-scoped:
  - `listPayments(tenantId, limit?)` — every `SubscriptionCheckout` row for
    the tenant (Phase 21), most recent first. Deliberately includes
    PENDING/FAILED/CANCELLED attempts, not just SUCCEEDED ones — a
    customer looking at "what happened when I tried to pay" needs to see a
    failed attempt, not just the one that eventually worked.
  - `listInvoices(tenantId, limit?)` — the same `SubscriptionCheckout`
    table, filtered to `SUCCEEDED`, reshaped into an invoice-like record
    with a deterministic `invoiceNumber` (`INV-YYYYMM-<8-char-id>`)
    computed from the row itself. No new table, no separately-tracked
    invoice sequence — see "Do not" below.
  - `listSubscriptionHistory(tenantId, limit?)` — every `Subscription` row
    for the tenant (Phase 15 already creates a new row per trial/upgrade/
    renewal rather than mutating one in place), most recent first. This
    already **is** the renewal history; nothing new to compute.
  - A shared `clampLimit()` helper enforces a default page size of 50 and a
    hard ceiling of 200 on the `?limit=` query param — this is a read for a
    human to look at, not a bulk export, so an unbounded or absurd
    client-supplied `take` isn't accepted.
- `backend/src/billing/billing.controller.ts` (new) — `BillingController`
  under `GET /billing/payments`, `GET /billing/invoices`,
  `GET /billing/subscriptions`. No `@RequirePermissions` on any of
  them — same reasoning as `SubscriptionsController` (Phase 17): any
  authenticated user of the tenant can view their own company's billing
  records, and every handler reads `tenantId` off the verified JWT via
  `@CurrentUser()`, never a client-supplied param, which is what "a
  company can only see its own subscription" (Phase 17's security note)
  looks like applied to billing.
- `backend/src/billing/billing.module.ts` (new) — no `AuditModule`
  import, since this module never mutates state and has nothing to audit;
  relies on `PrismaModule` being `@Global()` (unchanged from every other
  phase).
- `backend/src/app.module.ts` — registered `BillingModule`.
- Tests: `billing.service.spec.ts` (14 — tenant scoping on all three
  methods, default/oversized/garbage `limit` handling, payment history
  includes non-successful attempts, `paidAt` only ever set for a
  `SUCCEEDED` row even if `webhookProcessedAt` is somehow set on another
  status, invoice number derivation, `issuedAt` fallback to `createdAt`
  when `webhookProcessedAt` is missing), `billing.controller.spec.ts`
  (7 — tenant scoping on all three routes, a second caller never reuses
  the first caller's tenant, string `?limit=` query params are parsed to
  numbers before reaching the service). 21 new tests total.

## Do not (out of scope this phase, by design)

- No new `Invoice` or `Payment` ledger table — `SubscriptionCheckout`
  (Phase 21) already has everything a customer-facing "did I pay, when,
  how much" view needs; introducing a second, could-drift-out-of-sync
  table for the same facts is exactly the accounting-system scope-creep
  the roadmap says to avoid.
- No tax calculation, no line-item breakdown, no PDF generation, no email
  delivery of invoices. Billplz already emits its own payer-facing receipt
  for a paid FPX/DuitNow bill; this phase's job is letting the tenant see
  that history inside the app, not replacing a receipt.
- No mutation endpoints of any kind — this phase is read-only by design,
  matching "Customer can see billing records" as written.
- No invoice-number *sequence* (a persisted, gap-free running counter).
  The derived `INV-YYYYMM-<id>` format is unique and stable per checkout
  row without needing one; a real gap-free sequence is an accounting
  concern this phase deliberately doesn't take on.

## Known gap, deliberately not fixed

`listInvoices()` has no concept of a *refund* line — `CheckoutStatus`
already includes `REFUNDED` (added in Phase 21's schema, unused by any
service yet since no refund flow has been built), but Billplz itself has
no refund API (`BillplzPaymentProvider.supportsRefunds = false`), so there
is currently no code path that could ever produce a `REFUNDED` checkout
row for this to display. Not fixed here because it isn't reachable yet;
revisit if a future provider or manual-refund workflow starts writing
`REFUNDED` rows.

## Sandbox limitation

Same limitation as every prior phase: no live Postgres/Prisma engine,
`node_modules`, or network egress reachable in this build sandbox
(`binaries.prisma.sh` unreachable). No schema change this phase, so there
is no new migration to run — but **before trusting this beyond dev:** run
`prisma generate` once for real (this module relies on the `subscription`
→ `plan` include chain Phase 21/15 already defined) and run `npm test` for
real (tests here are written and self-consistent but never executed in
this sandbox).
