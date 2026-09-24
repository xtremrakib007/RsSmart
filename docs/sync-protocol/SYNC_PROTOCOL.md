# Sync Protocol Specification v1.0

## Overview
Event-sourcing based sync for offline-first clients (Sales App, POS).

## Event Schema
```json
{
  "eventId": "uuid-v4",
  "clientId": "device_fingerprint",
  "timestamp": "ISO-8601",
  "entity": "order|customer|product|inventory",
  "action": "CREATE|UPDATE|DELETE",
  "payload": { ...entity_data },
  "vectorClock": { "clientId": 45, "server": 120 }
}
```

## Sync Flow
1. Client batches local events
2. POST /sync/push → Server validates & queues
3. Server processes async (or sync for small batches)
4. Client POST /sync/pull → Gets server events since lastSyncAt
5. Client applies server events, updates vector clock

## Conflict Resolution
- Default: Last-write-wins (server timestamp)
- Business rules: Stock conflicts → flag for manual review
- Vector clocks detect causality, not concurrency

## Idempotency
All events processed idempotently by `eventId`.
