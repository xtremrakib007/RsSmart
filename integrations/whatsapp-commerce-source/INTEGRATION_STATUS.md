# WhatsApp Commerce Integration Status

This directory preserves the WhatsApp Commerce implementation as source for porting into the platform's canonical NestJS backend.

## Important
- The canonical backend is `../../backend` (NestJS + Prisma).
- Do NOT run this Express backend as a second production backend.
- Port controllers/services/data models into the canonical backend before production.
- Secrets and `.env` files are intentionally excluded from the merged archive.

## Features identified in this source
- WhatsApp Cloud API/webhooks
- WhatsApp account/inbox/conversations
- Templates
- Campaigns
- Customers/products/inventory/orders
- Cart/checkout
- Payments/delivery/invoices
- Notifications
- Analytics/marketing
- SaaS billing scaffolding
- AI scaffolding
- Localization/compliance/monitoring

## Production blockers
- Cloud API / provider credentials must be configured securely.
- Payment/billing providers contain test/mock implementations and require real providers.
- Multi-number support must be validated for the chosen WhatsApp architecture.
- All WhatsApp data must be tenant-isolated in the canonical Prisma schema.
- Queue/retry/idempotency/load testing is required before broadcasts go live.
