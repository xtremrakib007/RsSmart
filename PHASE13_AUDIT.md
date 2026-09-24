# Phase 13 — SaaS Database Audit (2026-08-30)

Scope per roadmap: audit only. No schema changes, no billing code in this
pass. Everything below is inspection of `backend/prisma/schema.prisma`
(941 lines, as left by Phase 11/12) plus a read of the service code that
queries the models called out below.

**Bottom line up front:** the schema has one relation that will fail
`prisma validate`/`prisma generate` outright (`UserOutlet` ↔ `Tenant`), and
four tenant-scoped models with no foreign key back to `tenants` at all. None
of this is new to this pass — Phase 11/12 explicitly flagged that the schema
was hand-edited and never run through Prisma's own tooling (no network
access to `binaries.prisma.sh` in that sandbox). This audit is the first
time it's been checked. **Recommend fixing the broken relation before
Phase 14 touches the schema again** — seeing that error mixed in with new
`SubscriptionPlan`/`Subscription` migration output would be confusing and
risks someone "fixing" it inside an unrelated migration.

---

## 1. Models requiring `tenantId` — ownership map

Every business-data model in this schema is tenant-scoped (this is a
single-database, `tenantId`-column multi-tenancy design, not
schema-per-tenant or database-per-tenant). Status of that scoping today:

| Model | `tenantId` column | FK to `Tenant` | Listed in `Tenant`'s relation array |
|---|---|---|---|
| User | ✅ | ✅ (cascade) | ✅ |
| DeviceToken | ✅ | ✅ (cascade) | ✅ |
| Role | ✅ | ✅ (cascade) | ✅ |
| **UserRole** | ❌ **missing** | — | — |
| Outlet | ✅ | ✅ (cascade) | ✅ |
| UserOutlet | ✅ | ❌ **broken — see §3.1** | ✅ (dangling reference) |
| Product | ✅ | ✅ (cascade) | ✅ |
| **Category** | ✅ (orphan column) | ❌ **missing** | ❌ |
| **Unit** | ✅ (orphan column) | ❌ **missing** | ❌ |
| Inventory | ✅ | ✅ (cascade) | ✅ |
| StockMovement | ✅ | ✅ (cascade) | ✅ |
| Customer | ✅ | ✅ (cascade) | ✅ |
| **CustomerVisit** | ✅ (orphan column) | ❌ **missing** | ❌ |
| Order | ✅ | ✅ (cascade) | ✅ |
| OrderItem | — (inherits via Order) | n/a | n/a |
| Payment | — (inherits via Order) | n/a | n/a |
| PosSession | ✅ | ✅ (cascade) | ✅ |
| PosCashMovement | ✅ | ✅ (cascade) | ✅ |
| SalesTarget | ✅ | ✅ (cascade) | ✅ |
| RoutePlan | ✅ | ✅ (cascade) | ✅ |
| AttendanceRecord | ✅ | ✅ (cascade) | ✅ |
| SyncEvent | ✅ | ✅ (cascade) | ✅ |
| AuditLog | ✅ | ✅ (cascade) | ✅ |
| WhatsAppAccount / Contact / Conversation / Cart / CartItem\* / Message / Campaign / CampaignRecipient / AutomationRule | ✅ | ✅ (cascade, except CartItem which inherits via Cart) | ✅ |

\* `WhatsAppCartItem` correctly has no `tenantId` of its own — it inherits
scope via `cartId`, same pattern as `OrderItem`/`Payment`. Consistent and
fine.

### 1.1 `UserRole` has no `tenantId` (finding, not necessarily a defect)

`UserRole` is a pure join row (`userId`, `roleId`) with no tenant column.
Because both `User` and `Role` are tenant-scoped and `users.service.ts`
(`assignRoles`) already re-validates that every `roleId` belongs to the
caller's `tenantId` before writing, there's **no cross-tenant privilege
escalation path today** — the application layer closes the gap the schema
leaves open. Flagging it anyway because:
- Any future direct query against `user_roles` (a report, a script, a new
  service) has to remember to join through `roles` to filter by tenant —
  nothing stops a mistake there.
- It can't be indexed or filtered by tenant on its own for
  auditing/debugging ("show me every role assignment for tenant X").

Recommend adding `tenantId` to `UserRole` as a Phase 14-adjacent cleanup
(small, additive, backfillable from `roles.tenant_id` via the existing
`roleId` — see §4).

---

## 2. Models requiring `outletId` — ownership map

Per the Phase 11 design comment already in the schema: outlet-level =
stock, POS terminals/sessions, cash, and operational sales records.
Company-level = catalog, customers, pricing, users/roles, subscription.

| Model | Has `outletId` | Correct per design? |
|---|---|---|
| Inventory | ✅ | Yes — stock is per-outlet |
| StockMovement | ✅ | Yes |
| Order | ✅ | Yes |
| PosSession | ✅ | Yes |
| PosCashMovement | ✅ | Yes |
| Product / Category / Unit | ❌ | Correct — catalog is company-wide |
| Customer / CustomerVisit | ❌ | Correct — customers are company-wide |
| OrderItem / Payment | ❌ | Correct — inherit scope via Order |
| SalesTarget / RoutePlan / AttendanceRecord | ❌ | Reasonable — these track a sales rep, not a location. Worth a product decision later if targets/routes ever need to roll up per-outlet, but not a defect. |
| WhatsApp\* (all 8 models) | ❌ | Reasonable for now — one WhatsApp Business number per company, not per outlet. Flag as a question for product, not a bug: if a multi-outlet customer wants a WhatsApp number per branch, this will need `outletId` added to `WhatsAppAccount` later. |

No model is silently missing `outletId` where the design calls for it.
Outlet scoping from Phase 11 was applied consistently to the operational
tables it targeted.

---

## 3. Migration / data-integrity risks

### 3.1 Blocking: `UserOutlet` ↔ `Tenant` relation will fail `prisma validate`

```prisma
model Tenant {
  ...
  userOutlets UserOutlet[]   // <- expects a matching relation field on UserOutlet
}

model UserOutlet {
  id         String   @id @default(uuid())
  tenantId   String   @map("tenant_id")
  userId     String   @map("user_id")
  outletId   String   @map("outlet_id")
  ...
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  outlet     Outlet   @relation(fields: [outletId], references: [id], onDelete: Cascade)
  // no `tenant Tenant @relation(...)` field
}
```

`Tenant.userOutlets` has nothing on the other side to pair with — Prisma
requires an explicit relation object field wherever a scalar FK column
exists for a one-to-many. This is a **schema compile error**, not a style
nit: `prisma validate` / `prisma generate` will refuse to run at all until
it's fixed, which blocks every later phase that touches `schema.prisma`
(starting with Phase 14's new subscription models).

This was very likely introduced during the Phase 11 hand-edit, since that
work was explicitly never run through real Prisma tooling. Fix is
mechanical (add the missing relation field + FK), but per this phase's
scope it's being called out here rather than fixed in this pass.

### 3.2 High: three tenant-scoped tables have no foreign key to `tenants`

`Category`, `Unit`, and `CustomerVisit` all carry a `tenant_id` column that
the application layer uses correctly (`products.service.ts`,
`customers.service.ts` both filter `where: { tenantId }` on every read/
write), but the column is a bare string in the schema — no `@relation`, no
entry in `Tenant`'s own relation list, no `onDelete: Cascade`. Concretely:

- Nothing at the database stops a row being written with a `tenant_id`
  that doesn't exist in `tenants` (typo, stale ID after a tenant was
  deleted, bug in a future script).
- Deleting a `Tenant` cascades correctly through 20+ related tables but
  silently **leaves orphaned rows behind** in these three — they won't be
  cleaned up, and won't show up in any of the cascade-delete tests that
  cover the other tables.
- They currently rely entirely on every call site remembering to filter by
  `tenantId` by convention. That's true today (both existing services do
  it), but it's exactly the kind of implicit invariant that breaks the
  first time someone adds a new query path (a report, an admin tool, a
  script) without knowing the convention.

Recommend adding the FK relation (and, while touching it, an `@@index` —
see §4) as a follow-up migration. Low risk to backfill: every existing row
already has a valid `tenant_id` value written by the app layer, so this is
additive (add constraint, no data rewrite).

### 3.3 Medium: `orders.client_transaction_id` uniqueness is tenant-wide, not outlet- or device-scoped

```prisma
@@unique([tenantId, clientTransactionId])
```

This is the idempotency key Phase 25 (POS idempotency) will lean on. It's
correctly nullable-safe (Postgres treats multiple `NULL`s as distinct, so
non-POS-originated orders without a client transaction ID are unaffected).
But the key is scoped to the whole tenant, not to the outlet or the device
that generated it. If two different outlets (or two POS devices) ever
generate the same `clientTransactionId` — plausible if that ID is built
from something device-local like a counter or timestamp rather than a
UUID — the second one will be silently rejected as a duplicate of the
first, even though they're unrelated sales. Worth confirming with whatever
generates `clientTransactionId` on the POS/Sales app side before Phase 25
starts; if it's already a UUID or otherwise globally unique, this is a
non-issue and can be closed out then.

### 3.4 Low: cascade-delete blast radius on `Tenant`

Every tenant-scoped table with a working FK cascades on `Tenant` deletion.
That's correct and intentional for a hard tenant-offboarding path, but
worth flagging now, before Phase 15 (subscription lifecycle) and Phase 23
(enforcement) exist: **there is currently no soft-delete/archival state for
a tenant** — only `TenantStatus.ACTIVE / SUSPENDED / TRIAL`, no
`CANCELLED`/`ARCHIVED`. If subscription cancellation ever calls
`prisma.tenant.delete(...)` directly (rather than just flipping status),
it is an instant, irreversible, cascading wipe of that company's entire
data — orders, inventory history, WhatsApp conversations, everything. Not
a Phase 13 fix, but Phase 15/22 should explicitly decide "cancel = status
flip + data retention window" vs. "cancel = eventual hard delete" before
any code path can reach `tenant.delete`.

### 3.5 Low: `recordVisit(tenantId, data: any)` accepts an untyped payload

`customers.service.ts` → `recordVisit` spreads `data: any` directly into
`prisma.customerVisit.create()`. Not a database-schema issue, so out of
strict scope for this audit, but noted here since it sits right next to
the `CustomerVisit` FK gap above: an untyped create on a table with no FK
enforcement is a slightly wider door than it needs to be. Worth a DTO pass
whenever that module is next touched (naturally fits Phase 24's security
audit).

---

## 4. Missing indexes / unique constraints

| Table | Gap | Why it matters |
|---|---|---|
| `Category` | No `@@index([tenantId])`, no `@@unique([tenantId, name])` | Category list queries (`getCategories`) filter by `tenantId` with no supporting index — full scan as data grows. No uniqueness also means the same tenant can create "Beverages" twice with no constraint stopping it. |
| `Unit` | No `@@index([tenantId])` | Same pattern as Category, smaller table so lower urgency. |
| `CustomerVisit` | No index on `customerId` or `userId` | `getVisits(customerId, tenantId)` and any future "visits by rep" report have no index to use beyond a full scan; the FK columns aren't auto-indexed by Postgres. |
| `UserRole` | Only `@@unique([userId, roleId])` | That unique index only serves lookups by `userId` first. "Find every user holding role X" (needed when disabling/deleting a role) can't use it efficiently — worth `@@index([roleId])` when this table is next touched. |
| `StockMovement` | No index on `inventoryId` alone | `@@index([tenantId, outletId, createdAt])` covers outlet-level movement history, but pulling the movement log for one specific `Inventory` row has nothing to use. |
| `AuditLog` | No index on `userId` | Has good tenant/entity/date coverage; "what did user X do" queries would scan. Likely fine until there's an actual admin UI that needs it. |

None of these are correctness bugs — they're the kind of thing that's fine
at pilot scale (Phases 37-38) and starts to hurt at Phase 39-40 volumes.
Flagging now per the audit's purpose; not proposing to fix any of them in
this pass (roadmap explicitly excludes schema rewrites from Phase 13).

---

## 5. What's already solid (no action needed)

- Multi-outlet inventory (`@@unique([tenantId, outletId, productId, warehouseId])`)
  correctly re-keyed in the last migration so stock is independent per
  outlet — verified against `migration.sql` §9, matches the schema.
- `Order`/`PosSession`/`PosCashMovement`/`Inventory`/`StockMovement` all
  have working cascade FKs to both `Tenant` and `Outlet`, with the
  `(tenantId, outletId, ...)` composite indexes each of their query
  patterns actually needs.
- `WhatsAppMessage.providerMessageId` is correctly globally unique (not
  tenant-scoped) — provider IDs are unique across the whole WhatsApp
  system, so scoping it by tenant would be wrong, not just unnecessary.
- Application-layer tenant filtering is consistently applied everywhere
  checked (`products.service.ts`, `customers.service.ts`,
  `users.service.ts`), including the three models with the FK gap in §3.2 —
  the gap is a missing safety net, not an active leak.

---

## 6. Recommended order of operations for Phase 14+

1. **Before Phase 14's migration**: fix §3.1 (`UserOutlet` relation) in its
   own tiny, clearly-labeled migration — it will block `prisma generate`
   for any schema work otherwise, including Phase 14's own.
2. Fold §3.2 (Category/Unit/CustomerVisit → Tenant FK + indexes) and the
   `UserRole.tenantId` addition from §1.1 into that same cleanup migration
   or the one immediately after — both are additive, low-risk, no data
   rewrite required.
3. Confirm §3.3 (`clientTransactionId` scoping) with the POS/Sales app's ID
   generation before Phase 25, not before.
4. Revisit §3.4 (tenant deletion semantics) when designing Phase 15's
   `cancel` state machine — needs a product decision, not a schema fix,
   before then.

**Done (per roadmap):** ownership map above covers every model; migration
and index risks documented; no billing code, no schema rewrites performed
in this pass.

---

## Addendum (2026-08-30) — hotfix applied, two more relations found

§3.1 and §3.2 were fixed in migration
`20260830090000_phase13_schema_integrity_hotfix` (schema.prisma updated to
match), rather than left for Phase 14 to trip over. While re-verifying
every relation pair in the schema programmatically (not just by reading
it, which is how the four issues above were found in the first place), two
more turned up that this document's original read-through missed:

- `Customer.whatsappCarts WhatsAppCart[]` pointed at a field that doesn't
  exist on `WhatsAppCart` at all (no `customerId`, no relation back).
  Unused in application code — removed.
- `User.whatsAppMessages WhatsAppMessage[] @relation("WhatsAppMessageCreatedBy")`
  had no matching owning field on `WhatsAppMessage` — that model's
  `createdBy` is (correctly, and consistent with
  `StockMovement.createdBy`/`PosCashMovement.createdBy`) a plain unenforced
  string, not a real relation. Removed the phantom array field from `User`.

Both were dead, unused Prisma-side declarations with no backing database
column, so no data migration was needed for either — just a schema.prisma
edit. A full static check (every relation field paired against its
counterpart on the other model) now comes back with zero issues. Real
`prisma validate`/`prisma generate` still couldn't be run in this sandbox
(`binaries.prisma.sh` unreachable, same limitation Phase 11/12 hit) —
**run it for real before trusting this beyond dev/staging.**

§3.3 (client transaction ID scope) and §3.4 (tenant deletion semantics)
were left as-is — both need a product decision, not a schema fix, and
that's still true.
