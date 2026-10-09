-- Durable lease for webhook processing. A lease is reclaimable after a worker crash.
ALTER TABLE "subscription_checkouts"
ADD COLUMN "webhook_processing_at" TIMESTAMP(3);
