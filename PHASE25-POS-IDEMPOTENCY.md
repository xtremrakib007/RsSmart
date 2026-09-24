# Phase 25 — POS Idempotency (2026-08-30)

## Goal
Prevent duplicate sales during retry / offline reconnect.

## What changed

### Schema
- `SyncEvent.idempotencyKey` (nullable) + `@@unique([tenantId, clientId, idempotencyKey])`
  so a device retrying a sync push does not create duplicate event rows.
  Migration: `20260830120000_phase25_pos_idempotency` (additive only).

### POS checkout API (`pos-transactions.service.ts`)
- Replaced `findFirst` with `findUnique` for the duplicate check (uses the
  existing `@@unique([tenantId, clientTransactionId])` index explicitly).
- Added race-condition handling: if the DB unique constraint throws `P2002`
  (two simultaneous requests with the same `clientTransactionId`), the
  service catches it and returns the existing receipt instead of a 500.

### Sync push (`sync.service.ts`)
- `pushEvents()` now extracts an `idempotencyKey` from each event
  (`event.idempotencyKey` → `event.payload.clientTransactionId` for
  `order.CREATE` → none). Before creating a `SyncEvent`, it checks
  `prisma.syncEvent.findUnique({ tenantId, clientId, idempotencyKey })`.
  If found, the existing event is returned immediately.

### Sync processor (`sync-event.processor.ts`)
- `applyOrderEvent()` now checks `payload.clientTransactionId` against the
  `Order` table before creating. If the order already exists (e.g., the
  device already synced successfully but never received the ack), the
  existing order is returned and the event is marked `COMPLETED`.

## Idempotency scope

`clientTransactionId` is scoped **tenant-wide** (same as the existing
`@@unique` constraint). This means a sale with `clientTransactionId =
"txn-123"` can only exist once per tenant, regardless of outlet or device.
This is intentional for POS: a terminal that roams between outlets should
not be able to accidentally create two orders with the same id.

For sync events, `idempotencyKey` is scoped to `(tenantId, clientId)` —
two different devices may reuse the same key without collision.

## Tests

| Test file | Coverage |
|-----------|----------|
| `pos-transactions.service.spec.ts` | Fast-path dedup, race-condition P2002 handling |
| `sync.service.spec.ts` | Duplicate sync event suppression, key derivation from `clientTransactionId` |
| `sync-event.processor.spec.ts` | Processor skips order creation when `clientTransactionId` already exists |

## Security

- Every idempotency lookup is scoped to `tenantId` from the verified JWT
  (direct API) or the `SyncEvent.tenantId` (processor). No cross-tenant
  deduplication leakage.
- The `clientTransactionId` is never returned to a different tenant.

## Remaining risks / deferred

- **Concurrent sync pushes from two different devices** with the same
  `clientTransactionId` would both create `SyncEvent` rows (different
  `clientId`), then the processor would catch the duplicate at the Order
  level. This is harmless (one order, one conflict event) but could be
  tightened by also checking `clientTransactionId` at the `pushEvents` level
  for `order.CREATE` events. Left as-is because the processor-level guard
  is sufficient for correctness.
- **No automated cleanup** of old `SyncEvent` rows — operational concern.
- **Sandbox limitation**: `prisma generate` / `migrate deploy` / `npm test`
  / `npm run build` need to run for real in a live environment.

## Done when
- `npm test` shows all 3 new spec files passing
- `npm run build` compiles
- `prisma validate` is green
- Sending the same sale request 3 times produces exactly 1 order
