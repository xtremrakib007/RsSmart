# RsSmart Phase 2 — WhatsApp Inbox

Implemented in the canonical NestJS backend.

## Included
- Conversation search by contact name/phone
- Status filtering
- Assignment filtering
- Conversation detail endpoint with message timeline
- Assign conversation to a tenant user
- Open/Pending/Closed status
- Bot enable/disable
- Archive/unarchive
- Tags
- Internal notes
- Mark conversation read
- Tenant-safe assigned-user validation
- Audit events for inbox mutations
- Unread counter increment on inbound messages

## Endpoints
- GET /whatsapp/conversations
- GET /whatsapp/conversations/:id
- PUT /whatsapp/conversations/:id
- POST /whatsapp/conversations/:id/read
- POST /whatsapp/conversations/:id/notes
- GET /whatsapp/conversations/:id/messages

## Not production-complete yet
The actual WhatsApp provider, webhook signature verification, queue workers, inbox UI, and end-to-end tests still need to be completed.
