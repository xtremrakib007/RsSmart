ALTER TYPE "OrderSource" ADD VALUE IF NOT EXISTS 'WHATSAPP';
CREATE TYPE "WhatsAppCartStatus" AS ENUM ('ACTIVE','CHECKOUT','CONVERTED','ABANDONED');
CREATE TABLE "whatsapp_carts" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "contact_id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "status" "WhatsAppCartStatus" NOT NULL DEFAULT 'ACTIVE',
  "currency" TEXT NOT NULL DEFAULT 'MYR',
  "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "whatsapp_carts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "whatsapp_carts_conversation_id_status_key" ON "whatsapp_carts"("conversation_id","status");
CREATE INDEX "whatsapp_carts_tenant_id_status_idx" ON "whatsapp_carts"("tenant_id","status");
ALTER TABLE "whatsapp_carts" ADD CONSTRAINT "whatsapp_carts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "whatsapp_carts" ADD CONSTRAINT "whatsapp_carts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "whatsapp_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "whatsapp_carts" ADD CONSTRAINT "whatsapp_carts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "whatsapp_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "whatsapp_carts" ADD CONSTRAINT "whatsapp_carts_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "whatsapp_cart_items" (
  "id" TEXT NOT NULL,
  "cart_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL,
  "unit_price" DECIMAL(12,2) NOT NULL,
  "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "line_total" DECIMAL(12,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "whatsapp_cart_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "whatsapp_cart_items_cart_id_product_id_key" ON "whatsapp_cart_items"("cart_id","product_id");
ALTER TABLE "whatsapp_cart_items" ADD CONSTRAINT "whatsapp_cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "whatsapp_carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "whatsapp_cart_items" ADD CONSTRAINT "whatsapp_cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
