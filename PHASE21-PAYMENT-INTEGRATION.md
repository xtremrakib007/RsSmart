# Phase 21 — Production Payment Integration (2026-08-30)

Scope per roadmap: connect the selected Malaysian/target-market payment
provider — checkout, successful payment, failed payment, signed webhook,
signature verification, idempotency. Critical requirement: **a browser
success redirect must NOT activate a subscription; verified provider
events must.** Done when a sandbox payment → webhook → subscription
activation works end to end.

Provider chosen: **Billplz** (FPX/DuitNow bank-transfer collection),
Malaysia-market-appropriate and already anticipated by Phase 20's doc
comments (`Billplz/Stripe/etc.`).

## What changed

- `backend/prisma/schema.prisma` / migration
  `20260830120000_phase21_subscription_checkouts` (additive only) — new
  `SubscriptionCheckout` model + `CheckoutStatus` enum. This is exactly the
  persistence Phase 20 deliberately deferred (see PHASE20 doc's "Known
  gap"): a local table mapping a provider's own checkout/bill reference
  back to `tenantId`/`subscriptionId`/`planId`, which must exist *before*
  a webhook can be resolved to a tenant or checked for replay. One row per
  checkout attempt, not per subscription — a tenant can retry a failed
  checkout and each attempt gets its own `providerReference`.
- `backend/src/payments/providers/billplz-payment.provider.ts` (new) —
  `BillplzPaymentProvider implements PaymentProviderAdapter` (Phase 20's
  interface, unchanged). `createCheckout` calls Billplz's `POST
  /api/v3/bills` (HTTP Basic auth, secret key as username); `verifyPayment`
  /`getPaymentStatus` call `GET /api/v3/bills/:id`. Rejects non-MYR amounts
  before ever calling the API. Env vars (`BILLPLZ_API_KEY`,
  `BILLPLZ_COLLECTION_ID`, `BILLPLZ_BASE_URL`) are read lazily per-call, not
  in the constructor, so the app can still boot with `PAYMENT_PROVIDER=mock`
  and Billplz vars unset. `supportsRefunds = false` — Billplz has no public
  API to reverse a paid FPX/DuitNow bill (refunds there are a manual bank
  transfer outside any API), so `refund()` throws `NotImplementedException`
  defensively even if called directly, on top of `PaymentsService` already
  short-circuiting on `supportsRefunds` before reaching this class.
- `backend/src/payments/providers/billplz-signature.util.ts` (new) — pure
  functions, no DI: `verifyBillplzSignature()` (Billplz signs a
  sorted `key=value` string joined by `|` over the payload's own fields,
  HMAC-SHA256 with a *separate* X Signature Key from the API secret key —
  a different scheme than the raw-body HMAC the WhatsApp Meta webhook
  already in this codebase uses) and `unwrapBillplzRedirectParams()`
  (strips the `billplz[...]` wrapper Billplz's redirect query params use,
  so the same verification function works for both the webhook body and
  the browser redirect query string).
- `backend/src/payments/subscription-checkout.service.ts` (new) —
  `SubscriptionCheckoutService`, the orchestration layer tying
  `PaymentsService` (Phase 20) and `SubscriptionsService` (Phase 15)
  together with the new persistence:
  - `createCheckout()` — reuses `SubscriptionsService.getCurrent()` /
    `getCurrentPlan()` so "does this subscription belong to this tenant"
    and "what does it cost" have exactly one implementation each; derives
    the checkout amount from the plan's `priceMonthly`, never from a
    client-supplied amount.
  - `getCheckoutStatusForOwner()` — the ONLY thing the browser-redirect
    path is allowed to call. Tenant-scoped lookup, then **re-queries
    Billplz directly** rather than trusting the locally stored status.
    Never calls `SubscriptionsService.activate()` — structurally, not by
    convention (see controller comment and the test asserting this).
  - `handleBillplzWebhook()` — the ONLY place that can call
    `SubscriptionsService.activate()`. Verifies the X-Signature first
    (rejects before touching the database); looks up the checkout by
    `providerReference`; if already `webhookProcessedAt`, no-ops
    (idempotent — Billplz retries webhook delivery and gives no unique
    event id to dedupe on otherwise); **re-verifies against Billplz's API**
    rather than trusting the webhook payload's own `paid` field (defense
    against a forged-but-signed replay of a stale payload); only then
    updates the checkout row and calls `activate()`, audit-logged under a
    `system:billplz-webhook` sentinel actor (no human `userId` for a
    webhook-driven mutation).
- `backend/src/payments/payments.controller.ts` (new) —
  `POST /payments/checkout/subscription` (authenticated,
  `@RequirePermissions(SUBSCRIPTION_MANAGE)`, tenantId from JWT only),
  `GET /payments/checkout/:providerReference/status` (authenticated,
  tenant-scoped read), `POST /payments/webhook/billplz` (`@Public()`,
  throttled, signature-verified inside the service), and
  `GET /payments/checkout/redirect` (public landing page fallback — echoes
  back only the bill id, never touches the checkout service at all). The
  controller's file comment states the activation split explicitly: the
  redirect-facing handlers have no code path to `activate()`, no matter
  what query params a browser carries.
- `backend/src/payments/dto/create-subscription-checkout.dto.ts` (new) —
  `subscriptionId`/`successUrl`/`cancelUrl` only; no `tenantId`, no
  `amount` — both always server-derived.
- `backend/src/payments/payments.module.ts` — added `'billplz'` branch to
  the existing `PAYMENT_PROVIDER` factory switch (Phase 20 pattern
  unchanged); registers `PaymentsController` and `SubscriptionCheckoutService`;
  imports `PrismaModule` and `SubscriptionsModule`.
- `backend/.env.example` — documented `PAYMENT_PROVIDER`,
  `BILLPLZ_API_KEY`, `BILLPLZ_COLLECTION_ID`, `BILLPLZ_X_SIGNATURE_KEY`
  (explicitly called out as a *separate* secret from the API key),
  `BILLPLZ_BASE_URL` (sandbox vs production), `BILLPLZ_CALLBACK_URL`.
- Tests: `billplz-signature.util.spec.ts` (7 — valid signature, field-order
  insensitivity, tampered-field rejection, wrong key, missing signature,
  unconfigured key, malformed hex doesn't throw), `billplz-payment.provider.spec.ts`
  (12 — checkout creation and auth header, non-MYR rejection, API error
  mapping, missing-config guard, paid/unpaid status mapping, 404 handling,
  refund always throws), `subscription-checkout.service.spec.ts` (14 —
  amount derivation, cross-subscription rejection, persistence shape,
  tenant-scoped status reads that never activate, signature rejection,
  unconfigured-key guard, unknown-bill accept-without-error, webhook
  idempotency, re-verification against the provider over the payload,
  activation + audit-log shape), `payments.controller.spec.ts` (6 — tenant
  scoping on both authenticated routes, `@RequirePermissions` metadata on
  checkout creation, `@Public` metadata on both webhook and redirect
  routes, webhook body pass-through, redirect landing touches nothing).
  39 new tests total.

## Do not (out of scope this phase, by design)

- No Stripe/other-provider adapter — Billplz was the one selected;
  swapping/adding another later is exactly the `PAYMENT_PROVIDER` switch
  Phase 20 built for this.
- No scheduled job to sweep a bill that's sat `PENDING`/`due` past its
  `due_at` into a terminal `FAILED`/`CANCELLED` checkout state — Billplz's
  own bill model has no explicit failed state for FPX (an abandoned bill
  just stays `due`), and building that sweep is a scheduling concern, not
  a payment-integration one. Flagged, not silently skipped.
- No UI/frontend changes — this is the API side only. The frontend needs
  to call `POST /payments/checkout/subscription`, redirect the browser to
  the returned `checkoutUrl`, and on return call
  `GET /payments/checkout/:providerReference/status` itself to show the
  result (see `payments.controller.ts`'s file comment on why the redirect
  endpoint stays read-only).

## Known gap, deliberately not fixed

`SubscriptionCheckoutService.handleBillplzWebhook()` re-audit-logs a
`SUBSCRIPTION_CHECKOUT_WEBHOOK_RECEIVED` entry every time Billplz retries
a webhook for a bill that's still genuinely `PENDING` (not yet
`webhookProcessedAt`, so not caught by the idempotency check, which only
applies once a checkout reaches a terminal state). This is intentional —
it can't silently drop a legitimate later "now it's paid" webhook — but
means a bill stuck `PENDING` for a long time before eventually paying (or
never paying) accumulates one audit-log row per retry. Not a correctness
issue, potentially a log-volume one at scale; revisit if it matters in
practice rather than adding unrequested complexity now.

## Sandbox limitation

No live Postgres/Prisma engine, `node_modules`, or network egress
reachable in this build sandbox (`billplz-sandbox.com` and
`binaries.prisma.sh` both unreachable) — same limitation as every prior
phase. **Before trusting this beyond dev:** run `prisma generate` /
`prisma migrate deploy` for real against a live database, run `npm test`
for real (tests here are written and self-consistent but never executed
in this sandbox), and run one actual Billplz **sandbox** payment
end-to-end (`BILLPLZ_BASE_URL=https://www.billplz-sandbox.com`) — a real
create-bill → pay → webhook round trip — before pointing this at
production Billplz.
