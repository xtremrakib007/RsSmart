# Phase 19 — Employee Invitation (2026-08-30)

Scope per roadmap: invite employee, assign outlet(s), assign role/
permissions, accept invitation, disable/remove employee. Done when
"Owner → invite → accept → login" works.

## What was already there (Phase 12, untouched)

- `AuthService.inviteUser()` / `POST /users/invite` — creates a user
  directly in the caller's tenant with roles/outlets validated against
  that tenant.
- `UsersService.assignRoles()` / `PATCH /users/:id/roles` — replace a
  user's roles, tenant-validated, bumps `tokenVersion`.
- `UsersService.disable()` / `enable()` / `remove()` and their routes —
  disable bumps `tokenVersion` so active sessions are revoked immediately;
  an actor can't disable themselves.

These four already covered "assign outlet(s)", "assign role/permissions",
and "disable/remove employee". What was genuinely missing was **accept
invitation**: `inviteUser` requires the *inviter* to type a password for
the new employee up front — there was no invite-token, no separate accept
step, and no way for the invitee to choose their own credentials. That's
the gap this phase closes.

## What changed

- `backend/prisma/schema.prisma` — new `Invitation` model + `InvitationStatus`
  enum (`PENDING` / `ACCEPTED` / `REVOKED` / `EXPIRED`). Snapshots
  `roleIds`/`outletIds` as plain JSON arrays at invite time (not a join
  table — nothing needs to query by them until accepted, at which point
  they become real `UserRole`/`UserOutlet` rows). Only the sha256 hash of
  the invite token is stored (`tokenHash`, unique) — same "only visible
  once" pattern as an API key. Purely additive migration
  `20260830110000_phase19_invitations`, no existing table touched.
- `backend/src/invitations/` (new module)
  - `invitations.service.ts` — `create` / `list` / `revoke` / `preview` /
    `accept`.
    - `create()`: same tenant-scoping and roleId/outletId validation as
      `inviteUser`, plus a check that no *other* `PENDING` invitation
      already exists for that email (revoke it first to send a new one).
      Generates a 32-byte random token, returns the **raw** token exactly
      once in the response; only its hash is persisted.
    - `accept()`: hashes the presented token, requires status `PENDING`
      and not expired, creates the `User` (with the roles/outlets captured
      at invite time) and marks the invitation `ACCEPTED` in one
      transaction, then logs the new user straight in via
      `AuthService.login()` — mirrors `registerCompany()`'s
      "create → return tokens" shape.
    - Expired-but-still-`PENDING` invitations are lazily flipped to
      `EXPIRED` the moment they're looked up (in `preview` or `accept`),
      so an expired link never silently still works just because no sweep
      job has run.
    - `preview()` is a public, read-only lookup (email/first name/last
      name/company name/expiry) so an accept-invitation page can show
      "You've been invited to join {company}" before the invitee types
      anything — it does not consume the invitation.
  - `invitations.controller.ts` — `@Controller('invitations')`:
    - `POST /` , `GET /`, `DELETE /:id` — authenticated, require
      `users.manage`, tenant always from `@CurrentUser()`.
    - `GET /preview/:token`, `POST /accept` — `@Public()`, throttled the
      same as `/auth/login` and `/auth/register` (5/min for accept,
      20/min for the read-only preview).
  - `invitations.module.ts` — imports `AuditModule` and `AuthModule`
    (needs `AuthService.login()` for the post-accept token issuance).
  - `invitations.service.spec.ts` (21 tests) / `invitations.controller.spec.ts`
    (6 tests) — validation branches, tenant-scoping proofs (two different
    callers never cross), token/password never leaked into `list()`/
    `preview()`/the object handed to `auth.login()`, expiry handling.
- `backend/src/app.module.ts` — registers `InvitationsModule`.

## Relationship to the old `inviteUser` / `POST /users/invite`

Left in place, unchanged, for backwards compatibility — nothing else in
this phase depends on it being removed, and the roadmap says not to modify
unrelated features. It has a real credential-hygiene problem (the inviter
now knows the new employee's password) that this phase's flow doesn't
have; new UI should call `POST /invitations` instead. Flagged here rather
than silently deprecated, since removing it is a product/API-versioning
decision, not something to do inside "smallest change for this phase."

## Do not

- No email/WhatsApp delivery of the invite link — out of scope (WhatsApp
  templates/media is Phase 29). The raw token is returned directly in the
  `POST /invitations` response; wiring it into an actual send channel is a
  separate, later change.
- No bulk-invite endpoint — one invitation per call, matching `inviteUser`'s
  existing shape.

## Known gaps, deliberately not fixed

- No scheduled sweep to flip old `PENDING` rows to `EXPIRED` in bulk —
  `preview`/`accept` do it lazily on lookup, which is correct for
  correctness (an expired token can never succeed) but means `list()` can
  show a `PENDING` row that's actually past `expiresAt` until someone
  actually tries it. Cosmetic only; revisit if the admin UI needs an
  accurate live count.
- No rate limit on `POST /invitations` itself beyond the general
  authenticated-route limits — the public `accept`/`preview` endpoints are
  throttled since those are the actually-abusable unauthenticated surface.

## Security

- Every authenticated route scopes to `tenantId` from the verified JWT
  only, matching every prior phase — no client-supplied tenant id anywhere.
- `roleIds`/`outletIds` are validated against the caller's own tenant
  before being snapshotted onto the invitation, same IDOR-closing check as
  `inviteUser`.
- The raw token is never persisted or logged — `AuditService.log()` calls
  around `create`/`revoke`/`accept` intentionally omit it.
- `accept()` cannot be replayed: the invitation is marked `ACCEPTED`
  inside the same transaction that creates the user, and `findPendingByToken`
  rejects anything not currently `PENDING`.

## Sandbox limitation

No live Postgres/Prisma engine was reachable from this build sandbox
(`binaries.prisma.sh` unreachable, no network egress) — same limitation
noted in every migration since Phase 11. `prisma generate` / `prisma
migrate deploy` / `prisma validate`, and a real `npm test` / `npm run
build`, all still need to run for real against a live database and a
real `node_modules` before this is trusted beyond dev. Code was reviewed
line-by-line against the existing codebase's own conventions (the same
sandbox-typing workaround already used in `subscriptions.service.ts` for
Prisma model types that don't exist until `generate` runs) but not
executed here.
