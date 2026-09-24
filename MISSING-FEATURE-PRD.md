# RsSmart Missing-Feature PRD

## Objective
Complete the missing functionality in the canonical RsSmart platform without creating duplicate backends.

## Architecture rule
ONE canonical backend: NestJS + Prisma + Redis/BullMQ. All clients consume this API.

## Phase 1 — WhatsApp Core
### Requirements
- WhatsAppAccount/Number entity with tenantId, provider, phoneNumberId, displayName, status, credentials reference, webhook status, timestamps.
- Conversation, Message, Contact, Template, Campaign and CampaignRecipient entities.
- Webhook verification and signature validation.
- Idempotent webhook ingestion using provider message/event IDs.
- Inbound message routing to tenant/number/conversation.
- Outbound message API.
- Media metadata and secure storage references.
- Session/connection lifecycle and health status.
- Audit every connect/disconnect/configuration action.

### Acceptance
- Two numbers belonging to one tenant operate independently.
- Tenant A cannot access Tenant B's numbers, messages or campaigns.
- Duplicate webhooks do not create duplicate messages/orders.

## Phase 2 — WhatsApp Inbox
- Conversation list/search/filter.
- Message timeline.
- Assignment/takeover.
- Tags and notes.
- Mark read/archive.
- Customer profile linkage.
- Human/bot status.

## Phase 3 — WhatsApp Commerce
- Product browsing.
- Cart.
- Checkout.
- Order creation in canonical Orders module.
- Inventory reservation/decrement.
- Payment status.
- Delivery status.
- Customer notifications.

## Phase 4 — Broadcast & Automation
- Campaign creation.
- Audience segmentation.
- Template selection.
- Scheduling.
- Queue worker.
- Rate limiting.
- Retry/backoff.
- Dead-letter queue.
- Delivery/failure analytics.
- Pause/resume/cancel.

## Phase 5 — Sales App Completion
- Login/device registration.
- Dashboard.
- Customer list/detail.
- Visit/check-in/check-out.
- Product catalog.
- Order creation.
- Collection/payment.
- Target/commission.
- Route.
- Offline database.
- Sync conflict resolution.

## Phase 6 — POS Completion
- Open day with denomination count.
- Barcode/non-barcode/PLU sale.
- Weight sale.
- Mixed payments.
- Hold/recall.
- Returns/refunds.
- Cash in/out.
- End-day reconciliation.
- Receipt/reprint.
- Printer/scanner/scale adapters.

## Phase 7 — Production Hardening
- E2E tests.
- Load tests.
- Security tests.
- Tenant-isolation tests.
- Backup/restore test.
- Queue failure/recovery tests.
- Monitoring and alerting.
- Production payment/provider verification.

## Definition of Done
A feature is complete only when UI + API + database + validation + permissions + logging + error handling + tests + integration are working together.
