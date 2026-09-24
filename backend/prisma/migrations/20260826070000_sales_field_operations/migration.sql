CREATE TABLE "sales_targets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "target_amount" DECIMAL(12,2) NOT NULL,
    "achieved_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "target_orders" INTEGER NOT NULL DEFAULT 0,
    "achieved_orders" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sales_targets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sales_targets_tenant_id_user_id_period_start_period_end_idx" ON "sales_targets"("tenant_id", "user_id", "period_start", "period_end");
ALTER TABLE "sales_targets" ADD CONSTRAINT "sales_targets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_targets" ADD CONSTRAINT "sales_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "route_plans" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "route_date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "customer_ids" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "route_plans_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "route_plans_tenant_id_user_id_route_date_idx" ON "route_plans"("tenant_id", "user_id", "route_date");
ALTER TABLE "route_plans" ADD CONSTRAINT "route_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "route_plans" ADD CONSTRAINT "route_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "work_date" TIMESTAMP(3) NOT NULL,
    "check_in_at" TIMESTAMP(3),
    "check_out_at" TIMESTAMP(3),
    "check_in_lat" DECIMAL(10,8),
    "check_in_lng" DECIMAL(11,8),
    "check_out_lat" DECIMAL(10,8),
    "check_out_lng" DECIMAL(11,8),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "attendance_records_tenant_id_user_id_work_date_key" ON "attendance_records"("tenant_id", "user_id", "work_date");
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
