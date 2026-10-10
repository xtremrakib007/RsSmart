-- CreateTable
CREATE TABLE "policy_acceptances" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "policy_key" TEXT NOT NULL,
    "policy_title" TEXT NOT NULL,
    "policy_version" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "subscription_id" TEXT,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "policy_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "policy_acceptances_tenant_id_user_id_policy_key_policy_version_flow_subscription_id_key"
ON "policy_acceptances"("tenant_id", "user_id", "policy_key", "policy_version", "flow", "subscription_id");

CREATE INDEX "policy_acceptances_tenant_id_accepted_at_idx"
ON "policy_acceptances"("tenant_id", "accepted_at");

CREATE INDEX "policy_acceptances_tenant_id_subscription_id_idx"
ON "policy_acceptances"("tenant_id", "subscription_id");

-- AddForeignKey
ALTER TABLE "policy_acceptances" ADD CONSTRAINT "policy_acceptances_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "policy_acceptances" ADD CONSTRAINT "policy_acceptances_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
