# Phase 8 — Real WhatsApp Cloud API

Added the real Meta Cloud API adapter to the canonical NestJS backend. Accounts can use provider `META_CLOUD`; each account is routed by its own `phoneNumberId`, so one tenant can manage multiple WhatsApp Business numbers. Added Graph API connectivity verification, text sending, public webhook verification, and inbound webhook mapping into the existing tenant-scoped inbox.

Configure `META_GRAPH_VERSION`, `META_WHATSAPP_ACCESS_TOKEN`, and `META_WHATSAPP_VERIFY_TOKEN`. The mock provider remains available for local development.

Still required: POST signature verification, per-tenant encrypted credential storage where tokens differ, media/templates/interactive messages, delivery/read status handling, provider rate-limit/retry handling, and real Meta test-number integration tests.
