# POS Phase 6 — Transaction Engine

Implemented in the central NestJS backend:
- atomic POS checkout
- stock validation and outbound movement
- split payments
- MYR receipt payload
- idempotency via clientTransactionId
- refunds with stock return
- cash in/out movements
- daily session summary
- walk-in customer fallback

Production follow-up:
- physical scanner/printer/scale drivers
- denomination-level opening/closing cash
- payment gateway/card terminal integrations
- automated E2E/load tests
