ALTER TABLE "orders" ADD COLUMN "client_transaction_id" TEXT;
CREATE UNIQUE INDEX "orders_tenant_id_client_transaction_id_key" ON "orders"("tenant_id", "client_transaction_id");

CREATE TYPE "PosCashMovementType" AS ENUM ('SALE', 'REFUND', 'IN', 'OUT');
CREATE TABLE "pos_cash_movements" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "type" "PosCashMovementType" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "reference_id" TEXT,
  "notes" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_cash_movements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pos_cash_movements_tenant_id_session_id_created_at_idx" ON "pos_cash_movements"("tenant_id","session_id","created_at");
ALTER TABLE "pos_cash_movements" ADD CONSTRAINT "pos_cash_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_cash_movements" ADD CONSTRAINT "pos_cash_movements_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "pos_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
