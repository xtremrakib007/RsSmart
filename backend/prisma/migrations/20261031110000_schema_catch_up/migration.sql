-- Catch-up: brings the database in line with schema.prisma. Phases 27-30
-- changed the schema (sync acks, webhook deliveries, WhatsApp templates,
-- message status enum, template params) without a migration.
-- CreateEnum
CREATE TYPE "WhatsAppTemplateStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAUSED', 'DELETED');

-- CreateEnum
CREATE TYPE "WhatsAppMessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED', 'PERMANENTLY_FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WhatsAppMessageType" ADD VALUE 'VIDEO';
ALTER TYPE "WhatsAppMessageType" ADD VALUE 'TEMPLATE';

-- DropForeignKey
ALTER TABLE "whatsapp_messages" DROP CONSTRAINT IF EXISTS "whatsapp_messages_created_by_fkey";

-- AlterTable
ALTER TABLE "whatsapp_campaign_recipients" ADD COLUMN     "template_params" JSONB;

-- AlterTable
ALTER TABLE "whatsapp_campaigns" ADD COLUMN     "template_id" TEXT;

-- AlterTable
DROP INDEX IF EXISTS "whatsapp_messages_status_next_retry_at_idx";
ALTER TABLE "whatsapp_messages" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "whatsapp_messages" ALTER COLUMN "status" TYPE "WhatsAppMessageStatus" USING ("status"::text::"WhatsAppMessageStatus");
ALTER TABLE "whatsapp_messages" ALTER COLUMN "status" SET DEFAULT 'SENT';

-- CreateTable
CREATE TABLE "sync_acks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "acked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_acks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "http_status" INTEGER NOT NULL,
    "error" TEXT,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "category" TEXT NOT NULL DEFAULT 'MARKETING',
    "status" "WhatsAppTemplateStatus" NOT NULL DEFAULT 'PENDING',
    "body" TEXT NOT NULL,
    "header_type" TEXT,
    "header_text" TEXT,
    "header_media_url" TEXT,
    "footer" TEXT,
    "buttons" JSONB,
    "provider_template_id" TEXT,
    "provider_status" TEXT,
    "provider_rejection_reason" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_acks_tenant_id_client_id_idx" ON "sync_acks"("tenant_id", "client_id");

-- CreateIndex
CREATE INDEX "sync_acks_tenant_id_client_id_acked_at_idx" ON "sync_acks"("tenant_id", "client_id", "acked_at");

-- CreateIndex
CREATE UNIQUE INDEX "sync_acks_tenant_id_client_id_event_id_key" ON "sync_acks"("tenant_id", "client_id", "event_id");

-- CreateIndex
CREATE INDEX "webhook_deliveries_tenant_id_processed_at_idx" ON "webhook_deliveries"("tenant_id", "processed_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_deliveries_provider_provider_event_id_key" ON "webhook_deliveries"("provider", "provider_event_id");

-- CreateIndex
CREATE INDEX "whatsapp_templates_tenant_id_status_idx" ON "whatsapp_templates"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_templates_tenant_id_account_id_name_language_key" ON "whatsapp_templates"("tenant_id", "account_id", "name", "language");

-- CreateIndex
DROP INDEX IF EXISTS "sync_events_tenantId_clientId_idempotency_key_idx";
CREATE UNIQUE INDEX "sync_events_tenantId_clientId_idempotency_key_idx" ON "sync_events"("tenant_id", "client_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "whatsapp_messages_status_next_retry_at_idx" ON "whatsapp_messages"("status", "next_retry_at");

-- AddForeignKey
ALTER TABLE "sync_acks" ADD CONSTRAINT "sync_acks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_acks" ADD CONSTRAINT "sync_acks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "sync_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_campaigns" ADD CONSTRAINT "whatsapp_campaigns_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "whatsapp_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "whatsapp_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
