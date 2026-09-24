CREATE TYPE "WhatsAppCampaignStatus" AS ENUM ('DRAFT','QUEUED','RUNNING','COMPLETED','PARTIAL','FAILED','CANCELLED');
CREATE TYPE "WhatsAppRecipientStatus" AS ENUM ('QUEUED','SENT','FAILED');
CREATE TYPE "WhatsAppAutomationTrigger" AS ENUM ('KEYWORD','EXACT_TEXT','STARTS_WITH');

CREATE TABLE "whatsapp_campaigns" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "message_template" TEXT NOT NULL,
  "media_url" TEXT,
  "status" "WhatsAppCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduled_at" TIMESTAMP(3),
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "total_recipients" INTEGER NOT NULL DEFAULT 0,
  "queued_count" INTEGER NOT NULL DEFAULT 0,
  "sent_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "created_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "whatsapp_campaigns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "whatsapp_campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "whatsapp_campaigns_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "whatsapp_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "whatsapp_campaigns_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON UPDATE CASCADE
);
CREATE INDEX "whatsapp_campaigns_tenant_id_status_scheduled_at_idx" ON "whatsapp_campaigns"("tenant_id","status","scheduled_at");
CREATE INDEX "whatsapp_campaigns_account_id_status_idx" ON "whatsapp_campaigns"("account_id","status");

CREATE TABLE "whatsapp_campaign_recipients" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "phone_number" TEXT NOT NULL,
  "name" TEXT,
  "customer_id" TEXT,
  "status" "WhatsAppRecipientStatus" NOT NULL DEFAULT 'QUEUED',
  "provider_message_id" TEXT,
  "error" TEXT,
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "whatsapp_campaign_recipients_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "whatsapp_campaign_recipients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "whatsapp_campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "whatsapp_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "whatsapp_campaign_recipients_campaign_id_phone_number_key" ON "whatsapp_campaign_recipients"("campaign_id","phone_number");
CREATE INDEX "whatsapp_campaign_recipients_tenant_id_status_idx" ON "whatsapp_campaign_recipients"("tenant_id","status");
CREATE INDEX "whatsapp_campaign_recipients_campaign_id_status_idx" ON "whatsapp_campaign_recipients"("campaign_id","status");

CREATE TABLE "whatsapp_automation_rules" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "account_id" TEXT,
  "name" TEXT NOT NULL,
  "trigger_type" "WhatsAppAutomationTrigger" NOT NULL,
  "trigger_value" TEXT NOT NULL,
  "response_text" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "created_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "whatsapp_automation_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "whatsapp_automation_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "whatsapp_automation_rules_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "whatsapp_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "whatsapp_automation_rules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON UPDATE CASCADE
);
CREATE INDEX "whatsapp_automation_rules_tenant_id_enabled_priority_idx" ON "whatsapp_automation_rules"("tenant_id","enabled","priority");
CREATE INDEX "whatsapp_automation_rules_account_id_enabled_idx" ON "whatsapp_automation_rules"("account_id","enabled");
