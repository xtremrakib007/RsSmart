# RsSmart Backend Security Implementation Checklist

**Status: verification plan only. Do not treat unchecked items as implemented.** Complete this against the actual source code, deployment and provider configuration.

## Tenant isolation
- [ ] Trace authenticated tenant identity from JWT/session to server-side request context.
- [ ] Audit every read/write query and every service for tenant scoping; never trust a client-provided tenant ID alone.
- [ ] Cover exports, uploads/downloads, search, reporting, background jobs, webhooks and admin/support operations.
- [ ] Add automated negative tests proving tenant A cannot read, mutate, export or infer tenant B's data.
- [ ] Document approved cross-tenant superadmin/support access and audit every use.

## Authentication and authorization
- [ ] Verify every protected route has authentication and explicit authorization.
- [ ] Test role/permission enforcement on the server, not only in UI.
- [ ] Configure secure token/session lifetime, revocation and refresh behavior.
- [ ] Require MFA for privileged cloud/repository/production access where available.
- [ ] Rate-limit login, password reset, sensitive actions and public endpoints.

## Secrets and data
- [ ] Scan repository history and build artifacts for secrets; rotate any exposed credential.
- [ ] Keep production secrets in managed secret storage/environment, never in source or client bundles.
- [ ] Confirm TLS and provider-supported encryption at rest for database, files and backups.
- [ ] Redact tokens, passwords, payment credentials and unnecessary personal data from logs.
- [ ] Use provider-hosted/tokenized payment checkout; never store CVV/CVC or full card details.

## Audit, monitoring and recovery
- [ ] Verify audit records cover login/security events, permission changes, tenant/admin changes, sensitive exports and payment status.
- [ ] Restrict audit-log access and define retention/tamper protections.
- [ ] Configure actionable alerts and verify delivery.
- [ ] Configure encrypted automated backups, retention and access restrictions.
- [ ] Perform and document a restore test; define recovery objectives.

## Webhooks and integrations
- [ ] Verify signatures using server-side secrets and reject invalid events.
- [ ] Add timestamp/replay protection and idempotency for duplicate events.
- [ ] Confirm payment status only from trusted provider-side verification/webhooks.
- [ ] Obtain written approval for the platform/direct-settlement merchant model before live payments.
- [ ] Review WhatsApp/email consent, provider terms and rate limits before production messaging.

## Release gate
- [ ] Run unit, integration, cross-tenant authorization, dependency, secret and security tests.
- [ ] Run migrations against a non-production database first and review rollback/recovery.
- [ ] Fix critical/high findings or document explicit risk acceptance by an accountable owner.
- [ ] Verify legal policy acceptance/versioning is actually wired into product flows.
- [ ] Record test results, owners, dates and remediation links.

**Next engineering step:** inspect the current NestJS guards, controllers, Prisma schema and tests; map each checklist item to existing code; implement only verified gaps; run tests and report evidence. This checklist itself does not implement controls.
