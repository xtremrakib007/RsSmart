# Phase 4 — WhatsApp Broadcast, Automation & Workers

Implemented into the single canonical NestJS backend.

## Added
- WhatsApp campaign/campaign-recipient database models
- Campaign creation, scheduling, start and cancel APIs
- Redis/BullMQ `whatsapp` queue
- Broadcast recipient worker with retry/backoff
- Campaign counters and completion/partial/failure states
- Template placeholders: `{{name}}`, `{{phone}}`
- Keyword/exact/starts-with automation rules
- Inbound-message automation reply path
- Tenant-safe campaign and automation queries
- Audit logging for campaign/rule lifecycle
- Prisma migration: `20260826061000_whatsapp_broadcast_automation`

## Important
The current WhatsApp provider is still the existing `MockWhatsAppProvider`. Phase 4 therefore implements the queueing/orchestration layer but does **not** claim real WhatsApp delivery. A real provider/session adapter is required before production use.

## Required runtime
- PostgreSQL
- Redis
- `prisma generate`
- Apply Prisma migrations

## Verification
This environment did not contain `node_modules`, so a full NestJS/TypeScript compile and Prisma client generation could not be executed here. Code was structurally checked and the migration was supplied explicitly.
