CREATE TYPE "WhatsAppAccountStatus" AS ENUM ('CONNECTING','CONNECTED','QR_REQUIRED','DISCONNECTED','ERROR');
CREATE TYPE "WhatsAppConversationStatus" AS ENUM ('OPEN','PENDING','CLOSED');
CREATE TYPE "WhatsAppMessageDirection" AS ENUM ('INBOUND','OUTBOUND');
CREATE TYPE "WhatsAppMessageType" AS ENUM ('TEXT','IMAGE','DOCUMENT','AUDIO','SYSTEM');

CREATE TABLE "whatsapp_accounts" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "phone_number" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'MOCK',
  "provider_account_id" TEXT,
  "phone_number_id" TEXT,
  "status" "WhatsAppAccountStatus" NOT NULL DEFAULT 'DISCONNECTED',
  "webhook_url" TEXT,
  "webhook_verified" BOOLEAN NOT NULL DEFAULT false,
  "qr_code" TEXT,
  "last_connected_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "whatsapp_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "whatsapp_accounts_tenant_id_display_name_key" ON "whatsapp_accounts"("tenant_id","display_name");
CREATE UNIQUE INDEX "whatsapp_accounts_tenant_id_phone_number_key" ON "whatsapp_accounts"("tenant_id","phone_number");
CREATE INDEX "whatsapp_accounts_tenant_id_status_idx" ON "whatsapp_accounts"("tenant_id","status");
ALTER TABLE "whatsapp_accounts" ADD CONSTRAINT "whatsapp_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "whatsapp_contacts" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "phone_number" TEXT NOT NULL,
  "name" TEXT,
  "customer_id" TEXT,
  "last_seen_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "whatsapp_contacts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "whatsapp_contacts_account_id_phone_number_key" ON "whatsapp_contacts"("account_id","phone_number");
CREATE INDEX "whatsapp_contacts_tenant_id_phone_number_idx" ON "whatsapp_contacts"("tenant_id","phone_number");
ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "whatsapp_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "whatsapp_conversations" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "contact_id" TEXT NOT NULL,
  "status" "WhatsAppConversationStatus" NOT NULL DEFAULT 'OPEN',
  "assigned_user_id" TEXT,
  "bot_enabled" BOOLEAN NOT NULL DEFAULT true,
  "unread_count" INTEGER NOT NULL DEFAULT 0,
  "last_message_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "whatsapp_conversations_account_id_contact_id_key" ON "whatsapp_conversations"("account_id","contact_id");
CREATE INDEX "whatsapp_conversations_tenant_id_status_last_message_at_idx" ON "whatsapp_conversations"("tenant_id","status","last_message_at");
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "whatsapp_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "whatsapp_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "whatsapp_messages" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "provider_message_id" TEXT NOT NULL,
  "direction" "WhatsAppMessageDirection" NOT NULL,
  "type" "WhatsAppMessageType" NOT NULL DEFAULT 'TEXT',
  "body" TEXT,
  "media_url" TEXT,
  "metadata" JSONB,
  "delivered_at" TIMESTAMP(3),
  "read_at" TIMESTAMP(3),
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "whatsapp_messages_provider_message_id_key" ON "whatsapp_messages"("provider_message_id");
CREATE INDEX "whatsapp_messages_tenant_id_conversation_id_created_at_idx" ON "whatsapp_messages"("tenant_id","conversation_id","created_at");
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "whatsapp_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
