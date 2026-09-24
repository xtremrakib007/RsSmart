# Phase 7 — Production Hardening

Implemented:
- request correlation IDs (`x-request-id`)
- explicit CORS allow-list behavior; no wildcard fallback
- graceful Nest shutdown hooks
- liveness/readiness/health endpoints
- production environment validation script
- PostgreSQL backup and restore scripts
- retention policy for local backups

Before production:
1. Put secrets in a managed secret store, not `.env` in source control.
2. Run `npm run build`, unit tests and E2E tests in CI.
3. Run `node scripts/validate-env.mjs` with production environment variables.
4. Test database restore regularly.
5. Configure external monitoring/alerting and persistent log storage.
6. Run k6/load tests against a staging environment.
7. Perform an independent security review.
8. Configure real WhatsApp provider credentials and verify webhook signatures.
