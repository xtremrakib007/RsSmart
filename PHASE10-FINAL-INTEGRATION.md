# Phase 10 — Final Integration & Verification Foundation

Implemented in the canonical project:

- POS opening denomination capture (`openingDenominations`)
- POS closing denomination capture (`closingDenominations`)
- Prisma migration for denomination JSON data
- Production-readiness static verifier (`backend/scripts/verify-production-readiness.mjs`)
- `npm run verify:production` command

## Verification gate

A release candidate must pass:

1. `npm run verify:production`
2. `npm run prisma:generate`
3. `npm run build`
4. `npm test`
5. `npm run test:e2e`
6. Android Sales build + install test
7. Android POS build + hardware test
8. Windows POS build + printer/scanner/scale/cash-drawer test
9. Windows ERP build + API integration test
10. Meta WhatsApp test-number webhook/send/receive/status test
11. k6/Artillery load test
12. OWASP/security review

This phase does **not** claim those environment-dependent tests have been executed in this workspace.
