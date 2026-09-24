# Phase 24 — Tenant & Outlet Security Audit (2026-08-30)

## Goal
Prove Company A cannot access Company B or unauthorized outlets.

## Method
1. Manual code review of every controller/service for tenant/outlet scoping.
2. E2E tests spawning two complete tenants and attempting every cross-tenant/cross-outlet attack vector.

## Findings

### Critical — Upload Module (Fixed)
**Issue:** `UploadController.deleteFile()` and `getFileUrl()` accepted any
arbitrary filename with **no tenant ownership check**. Any authenticated user
could delete or generate presigned URLs for any other tenant's files by
guessing or knowing the filename.

**Fix:** All uploads are now stored under `tenants/{tenantId}/{folder}/`.
`deleteFile` and `getFileUrl` reject any filename not starting with the
caller's tenant prefix with HTTP 403.

### Low — Query Param Filter Manipulation (Safe by Design)
Several list endpoints accept foreign-key query params (`outletId`,
`customerId`, `salesRepId`, `userId`). Manual review confirmed every
service method adds `tenantId` to the Prisma `where` clause alongside the
filter, so cross-tenant IDs in query params naturally return empty results.
No code change needed, but tests were added to prove it.

### Good — Tenant Isolation Patterns
Every module reviewed uses `tenantId` from the verified JWT (`@CurrentUser`)
and scopes Prisma queries with `where: { tenantId }`. No endpoint was found
that trusts a client-supplied tenant identifier.

### Good — Outlet Isolation Patterns
`OutletGuard` is applied to all inventory, order-creation, and POS-session
routes. It resolves the outlet from `x-outlet-id` (or the user's default),
verifies the outlet belongs to the user's tenant, and enforces that
non-admin users have an explicit `UserOutlet` assignment.

### Good — Auth Pipeline
Global guards (JwtAuthGuard → RolesGuard → PermissionsGuard) ensure every
route requires a valid, non-revoked JWT by default. `@Public()` is used
only for auth and invitation preview/accept endpoints.

## Tests Added

| Test File | Coverage |
|-----------|----------|
| `test/security/tenant-isolation.e2e-spec.ts` | 25+ cross-tenant IDOR attempts across orders, products, customers, outlets, users, POS sessions, reports, WhatsApp, upload, subscriptions, billing |
| `test/security/outlet-isolation.e2e-spec.ts` | Staff blocked from unauthorized outlets, manager allowed, inventory qty isolation per outlet, POS session list isolation |
| `test/security/helpers.ts` | `seedTenant()` — spins up a complete tenant with owner, manager, staff, two outlets, product, customer, order |

## Files Changed

| File | Change |
|------|--------|
| `src/upload/upload.controller.ts` | Tenant-prefix upload paths + ownership enforcement on read/delete |
| `test/security/tenant-isolation.e2e-spec.ts` | New |
| `test/security/outlet-isolation.e2e-spec.ts` | New |
| `test/security/helpers.ts` | New |

## Remaining Risks / Deferred

- **WhatsApp webhook signature verification** — Phase 28 covers this.
- **POS device limit enforcement** — Phase 23 covers this.
- **File upload size/type validation** — not a tenant isolation issue; handled at nginx/ingress level.
- **No automated scheduled cleanup** of old uploaded files — operational concern, not security.
