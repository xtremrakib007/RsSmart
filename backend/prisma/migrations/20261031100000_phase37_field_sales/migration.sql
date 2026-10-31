-- Phase 37: field sales — customers assigned to a salesman and a route,
-- attendance selfies.

ALTER TABLE "customers" ADD COLUMN "assigned_rep_id" TEXT;
ALTER TABLE "customers" ADD COLUMN "route_name" TEXT;
CREATE INDEX "customers_tenant_id_assigned_rep_id_idx" ON "customers"("tenant_id", "assigned_rep_id");
ALTER TABLE "customers" ADD CONSTRAINT "customers_assigned_rep_id_fkey" FOREIGN KEY ("assigned_rep_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attendance_records" ADD COLUMN "check_in_photo" TEXT;
ALTER TABLE "attendance_records" ADD COLUMN "check_out_photo" TEXT;
