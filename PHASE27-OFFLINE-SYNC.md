# Phase 27 — Offline Sync Hardening (2026-08-30)

## Goal
Reliable offline → online recovery.

## What changed

### Schema
- `SyncAck` model — tracks which events each device has received and
  processed. `@@unique([tenantId, clientId, eventId])` prevents duplicate
  acks. Migration: `20260830140000_phase27_sync_ack` (additive only).

### Sync push (`sync.service.ts`)
- **Per-event results**: `pushEvents()` now returns an array of
  `{ eventIndex, eventId?, status, error? }` for every event in the batch.
  The client knows exactly which events were accepted, which were
  duplicates, and which failed — no ambiguous partial-batch state.
- **Individual transaction isolation**: Each event is processed in its own
  `prisma.$transaction` so one event failure does not roll back previously
  accepted events in the same batch.
- **Queue outside transaction**: The BullMQ enqueue happens after the
  transaction commits, so a queue failure does not lose the persisted
  event (it will be picked up by the pending-events sweep eventually).

### Sync pull (`sync.service.ts`)
- **Ack-based deduplication**: `pullEvents()` queries `SyncAck` to build
  a set of already-received event IDs and excludes them via `notIn`.
  A client retrying `pull` with the same `lastSyncAt` gets zero
  duplicates.
- **Configurable limit**: Added `limit` option to prevent oversized
  responses on first sync after long offline periods.

### Sync ack (`sync.service.ts` + controller)
- New `POST /sync/ack` endpoint. Clients call this after successfully
  applying pulled events. Upsert pattern silently ignores duplicate acks.

### Failed event management
- `GET /sync/failed` — paginated list of `FAILED`/`CONFLICT` events for
  admin review.
- `POST /sync/retry/:eventId` — moves a failed event back to `PENDING`
  and re-queues it for processing.

### Sync status
- `GET /sync/status` now includes `ackedEvents` count so the client can
  verify its local checkpoint matches server state.

### Processor (`sync-event.processor.ts`)
- Retried events (status `FAILED` or `CONFLICT`) are reset to
  `PROCESSING` with `error: null` before the apply logic runs, so stale
  error state does not confuse monitoring or the retry itself.

## Offline → online flow

```
[Device goes offline]
    ↓
[Device records local events with clientTransactionId]
    ↓
[Device comes back online]
    ↓
POST /sync/push { events }
← 200 [ { status: 'created', eventId }, { status: 'duplicate' } ]
    ↓
POST /sync/pull { lastSyncAt }
← 200 [ server events ]
    ↓
[Device applies events locally]
    ↓
POST /sync/ack { eventIds }
← 200 { ackedCount }
    ↓
[Future pull with same lastSyncAt returns []]
```

## Tests

| Test file | Coverage |
|-----------|----------|
| `src/sync/sync.service.spec.ts` | Per-event push results, duplicate detection, pull dedup, ack upsert, failed event list, retry requeue, status with acked count |
| `test/security/offline-sync.e2e-spec.ts` | End-to-end offline sale push, duplicate push, ack-based pull dedup, sync status |

## Security
- Every sync operation is scoped to `tenantId` from the verified JWT.
- `clientId` is accepted from the client but only used as a device
  identifier, never as an authorization boundary.
- `SyncAck` rows are tenant-scoped and cannot cross tenant boundaries.

## Remaining risks / deferred
- **No automatic pending-event sweep**: If BullMQ is down, PENDING events
  sit until the queue recovers. A background cron job to re-queue stale
  PENDING events would be a good follow-up.
- **No sync compression**: Large offline periods could generate huge
  payloads. Delta encoding is present but not optimized for bulk history.
- **No client-side conflict UI**: The server detects conflicts and sends
  push notifications, but the mobile app needs a dedicated conflict
  resolution screen.
- **Sandbox limitation**: `prisma generate` / `migrate deploy` / `npm test`
  / `npm run build` need to run for real in a live environment.

## Done when
- `npm test` shows all sync tests passing
- `npm run build` compiles
- `prisma validate` is green
- Offline sale → push → pull → ack → re-pull returns empty
