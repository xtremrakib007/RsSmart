-- Phase 30: WhatsApp Retry & Failure Handling
-- Add idempotency key to SyncEvent (Phase 25/27 gap fix)
ALTER TABLE "sync_events" ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;

-- Add unique constraint for idempotency (will fail if duplicates exist)
-- If this fails, clean duplicate (tenantId, clientId, idempotencyKey) rows first.
CREATE UNIQUE INDEX IF NOT EXISTS "sync_events_tenantId_clientId_idempotency_key_idx"
  ON "sync_events" ("tenant_id", "client_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;

-- Add retry tracking fields to WhatsApp messages
ALTER TABLE "whatsapp_messages"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'SENT',
  ADD COLUMN IF NOT EXISTS "retry_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "failed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failure_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "next_retry_at" TIMESTAMP(3);

-- Index for retry scheduler: find failed messages due for retry
CREATE INDEX IF NOT EXISTS "whatsapp_messages_status_next_retry_at_idx"
  ON "whatsapp_messages" ("status", "next_retry_at");
