-- Phase 19 — Employee Invitation
--
-- Adds `invitations`: a pending offer for someone to join an EXISTING
-- tenant via a one-time token, so a company admin no longer has to choose
-- a new employee's password for them (the old AuthService.inviteUser
-- direct-create path, kept only for backwards compatibility — see
-- PHASE19-EMPLOYEE-INVITATION.md). roleIds/outletIds are snapshotted as
-- plain JSON arrays at invite time; they become real UserRole/UserOutlet
-- rows only once the invitation is accepted.
--
-- As with prior hand-written migrations in this repo, no live Postgres/
-- Prisma engine was reachable from the build sandbox to run
-- `prisma migrate dev` / `prisma validate` — run both for real against a
-- copy of a production-like database before trusting this beyond dev.
--
-- Purely additive: one new table, one new enum, no existing table touched,
-- nothing dropped.

BEGIN;

-- ── 1. Invitation status enum ───────────────────────────────────────────
CREATE TYPE "InvitationStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'REVOKED',
    'EXPIRED'
);

-- ── 2. invitations ───────────────────────────────────────────────────────
CREATE TABLE "invitations" (
    "id"                  TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL,
    "email"               TEXT NOT NULL,
    "first_name"          TEXT NOT NULL,
    "last_name"           TEXT NOT NULL,
    "role_ids"            JSONB NOT NULL,
    "outlet_ids"          JSONB NOT NULL,
    "token_hash"          TEXT NOT NULL,
    "status"              "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invited_by_user_id"  TEXT NOT NULL,
    "expires_at"          TIMESTAMP(3) NOT NULL,
    "accepted_at"         TIMESTAMP(3),
    "accepted_user_id"    TEXT,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");
CREATE INDEX "invitations_tenant_id_status_idx" ON "invitations"("tenant_id", "status");
CREATE INDEX "invitations_tenant_id_email_idx" ON "invitations"("tenant_id", "email");

ALTER TABLE "invitations"
    ADD CONSTRAINT "invitations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invitations"
    ADD CONSTRAINT "invitations_invited_by_user_id_fkey"
    FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
