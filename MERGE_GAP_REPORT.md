# RsSmart Merge & Gap Report

## Source archives reviewed
1. `merged-repo-fixed.zip` — selected as canonical base.
2. `whatsapp-commerce-complete-v2.zip` — preserved under `integrations/whatsapp-commerce-source/` for controlled porting.

## Canonical architecture decision
Use ONE production backend: `backend/` (NestJS + Prisma + BullMQ/Redis).
The Express WhatsApp backend is NOT deployed as a second production backend. Its useful modules are source material for the canonical WhatsApp module.

## Present in canonical base
- Authentication/users
- Products/categories/units
- Customers/customer visits
- Orders/order items/payments
- Inventory/stock movements
- POS sessions
- Reports
- Offline sync protocol/queues/processors
- Audit logging
- Push notifications
- WebSocket infrastructure
- Redis/BullMQ queue infrastructure
- Docker/Kubernetes/nginx/Prometheus/k6 foundations
- Android POS project
- Windows POS project
- Windows ERP project
- Android Sales project scaffold

## WhatsApp source provides additional functionality
- Cloud API/webhook controllers and services
- Inbox/takeover/assignment/tags/notes
- Templates
- Campaigns
- Cart/checkout
- Delivery/invoice/payment scaffolding
- Notifications/analytics/marketing
- onboarding/team/localization/compliance/monitoring
- WhatsApp message routing

## Still missing / needs implementation or verification in canonical system
### P0
- Canonical NestJS WhatsApp module
- Prisma models/migrations for WhatsApp accounts, numbers, sessions, contacts, conversations, messages, templates, campaigns and recipients
- True multi-number tenant isolation and lifecycle management
- WhatsApp webhook verification + idempotent processing
- Queue-based outbound messages and broadcast workers
- Retry/backoff/dead-letter handling
- Real provider credentials/configuration and production verification
- Real payment provider integration
- End-to-end ERP ↔ POS ↔ Sales ↔ WhatsApp inventory/order consistency
- Production authentication/RBAC verification across every module

### P1
- Full Sales Android UI/business flows (current archive is mainly project/config scaffold)
- POS open-day denomination entry, close-day reconciliation and complete reporting verification
- Weight-sale and weighing-scale integration verification
- POS hardware integration testing
- Offline conflict resolution tests
- Customer CRM unified view
- Complete WhatsApp inbox UI integration with canonical API
- Campaign scheduler/rate limits/analytics
- Automated notifications

### P2
- Advanced accounting/GL
- Loyalty
- Advanced marketing automation
- Subscription billing production integration
- AI assistant production implementation
- Advanced delivery/logistics

## Do not rebuild
Do not recreate products, customers, orders, inventory, auth, queues, audit, sync or POS-session foundations unless code review/testing proves a defect. Port missing WhatsApp capabilities into the existing architecture.
