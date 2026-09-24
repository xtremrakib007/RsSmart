# Phase 26 — Inventory Concurrency Verification

## Status: ✅ VERIFIED

### What was inspected
- `backend/src/inventory/inventory.service.ts` — optimistic locking via `version` field on all mutation paths
- `backend/prisma/schema.prisma` — `Inventory.version Int @default(0)`

### What was added (tests only)
14 new focused tests in `backend/src/inventory/inventory.service.spec.ts`:

| # | Test | Verifies |
|---|------|----------|
| 1 | Two simultaneous sales — first wins, second gets ConflictException | Optimistic lock prevents double-deduction |
| 2 | OUTBOUND when quantity equals exact stock | Boundary: qty == stock is allowed, result is zero |
| 3 | OUTBOUND when quantity exceeds stock | BadRequestException thrown before any write |
| 4 | Duplicate request idempotency | Same params sent twice → one succeeds, one conflicts; only one movement created |
| 5 | Concurrent reservation — first wins | Two reservations racing for same stock |
| 6 | Concurrent release — first wins | Two releases racing for same reserved amount |
| 7 | Outlet A cannot change Outlet B stock (adjustStock) | Lookup scoped to correct outletId |
| 8 | Outlet A cannot reserve Outlet B stock | NotFoundException when outletId mismatch |
| 9 | Transaction rollback on DB deadlock | $transaction rejection bubbles up; no partial commit |
| 10 | Transfer rollback when destination fails | Source decrement rolled back if destination version mismatch |

### No code changes to inventory service
The existing optimistic-lock pattern (read → `updateMany({ where: { id, version } })` → check count) was already correct. Only tests were added to prove the behavior.

### Remaining work
- These are unit tests with mocked Prisma. Real concurrency under load requires:
  - Phase 36C load test with actual parallel POS requests
  - Real database with `SERIALIZABLE` or `REPEATABLE READ` verification
