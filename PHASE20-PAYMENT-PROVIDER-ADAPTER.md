# Phase 20 — Payment Provider Adapter (2026-08-30)

Scope per roadmap: keep payment provider logic isolated behind an
interface/adapter (create checkout/payment, verify payment, payment
status, refund if supported), with a mock provider usable in tests. Done
when the abstraction works without a real provider.

## What changed

- `backend/src/payments/interfaces/payment-provider.interface.ts` (new) —
  `PaymentProviderAdapter`: `createCheckout` / `verifyPayment` /
  `getPaymentStatus` / `refund`, plus `name` and `supportsRefunds` so
  callers can check refund support without a try/catch. All money is
  minor units (`{ amount: 1000, currency: 'MYR' }` = RM 10.00), matching
  how every real gateway represents money and avoiding float rounding.
- `backend/src/payments/providers/mock-payment.provider.ts` (new) —
  `MockPaymentProvider`, in-memory (`Map`, process-only, resets on
  restart). Implements the full interface plus test-only
  `simulateSuccess()` / `simulateFailure()` / `reset()` that are
  deliberately **not** part of `PaymentProviderAdapter` — real calling
  code can only ever see `PENDING`/`SUCCEEDED`/`FAILED`/etc. through the
  interface, the same as it will with a real gateway's webhook, which is
  the point of testing against this rather than poking internal state.
  Supports partial refunds (rejects a refund total exceeding the original
  amount) and full refunds (flips status to `REFUNDED`).
- `backend/src/payments/payments.constants.ts` (new) — `PAYMENT_PROVIDER`
  DI token (a `Symbol`) and `PAYMENT_PROVIDER_NAME` (env `PAYMENT_PROVIDER`,
  default `'mock'`).
- `backend/src/payments/payments.service.ts` (new) — `PaymentsService`,
  the only thing outside `PaymentsModule` that should hold a reference to
  `PaymentProviderAdapter`. Injects tenantId into `createCheckout()`
  (never trusts a client-supplied one — same pattern as every other
  service in this codebase), audit-logs `createCheckout`/`refund`
  (mutations) but not `verifyPayment`/`getPaymentStatus` (read-only,
  matching e.g. `OutletsService.list()`/`get()` not being audited either).
  `refund()` throws `NotImplementedException` up front if
  `provider.supportsRefunds` is `false`, without calling the provider.
  Audit log entries never include the caller-supplied `metadata` bag —
  only `referenceType`/`referenceId`/`amount`/`currency`/`provider`.
- `backend/src/payments/payments.module.ts` (new) — binds `PAYMENT_PROVIDER`
  to `MockPaymentProvider` via a `useFactory` switch keyed on
  `PAYMENT_PROVIDER_NAME`. The `default` branch throws rather than
  silently falling back to the mock, so a misconfigured `PAYMENT_PROVIDER`
  env var in a real environment fails loud at boot instead of quietly
  processing real money through a fake provider.
- `backend/src/app.module.ts` — registers `PaymentsModule`.
- Tests: `mock-payment.provider.spec.ts` (16 tests — checkout creation,
  amount validation, verify/status for every terminal state, full and
  partial refunds, over-refund rejection, unknown-reference handling,
  `reset()`) and `payments.service.spec.ts` (9 tests — tenant injection,
  audit-log shape and metadata exclusion, read-only calls not audited,
  refund-unsupported short-circuit).

## Do not (out of scope this phase, by design)

- No real gateway (Billplz/Stripe/ToyyibPay/etc.) — that's Phase 21.
- No checkout/webhook HTTP endpoints — nothing routes an external request
  into `PaymentsService` yet. Phase 21 adds the controller.
- No database persistence of checkout state — `MockPaymentProvider`'s
  in-memory `Map` is a test/dev convenience, not a design decision to
  carry forward. A real provider's checkout state lives with the provider
  (queried via `verifyPayment`) and/or in whatever local record Phase 21
  decides to persist for webhook correlation — that decision belongs to
  Phase 21, not this one.

## Known gap, deliberately not fixed

`PaymentsService.verifyPayment()` / `getPaymentStatus()` / `refund()` take
a bare `providerReference` and do **not** check it belongs to the calling
tenant — there is no local table yet mapping a `providerReference` back to
a `tenantId` to check against, because Phase 20 intentionally has no
persistence (see "Do not" above). This is not yet an active
vulnerability: no controller in this phase exposes these methods over
HTTP, so there is no external caller who could supply an arbitrary
reference. **Phase 21, which adds the checkout endpoint and webhook
handler, must persist that mapping and add the tenant check before any of
these three methods are reachable from an HTTP request** — flagged here
rather than deferred silently.

## Sandbox limitation

No live Postgres/Prisma engine or `node_modules` reachable in this build
sandbox (no network egress) — same limitation as every prior phase. This
phase adds no schema/migration, so there's nothing Prisma-specific to
re-verify, but `npm test` / `npm run build` still need to run for real
before trusting this beyond dev.
