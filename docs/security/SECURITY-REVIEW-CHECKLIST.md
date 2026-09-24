# Phase 35A — Final Security Review Checklist

## Tenant Isolation
- [ ] Every Prisma query includes `tenantId` in `where`
- [ ] No `findMany` without `tenantId` filter
- [ ] Admin endpoints that list all tenants are explicitly marked and guarded
- [ ] Cross-tenant IDOR tests pass (Phase 24)

## Outlet Isolation
- [ ] Every outlet-scoped endpoint validates `x-outlet-id` header
- [ ] Staff cannot access unauthorized outlets (Phase 24)
- [ ] Inventory queries scoped to `(tenantId, outletId)`
- [ ] POS transactions scoped to outlet

## RBAC / Permissions
- [ ] `@Roles()` decorator applied to all sensitive endpoints
- [ ] `RolesGuard` validates permissions, not just role names
- [ ] No hardcoded role checks in service layer
- [ ] Permission strings match the database seed

## Authentication
- [ ] JWT secret is ≥ 32 bytes random
- [ ] JWT refresh tokens stored securely
- [ ] Token expiration reasonable (access: 15-60min, refresh: 7-30days)
- [ ] Password reset tokens are single-use and time-limited
- [ ] No plaintext passwords in logs

## Rate Limiting
- [ ] `ThrottlerModule` applied globally
- [ ] Public endpoints (webhooks) have stricter limits
- [ ] Login endpoints have aggressive limits
- [ ] Rate limit keyed by IP + tenantId, not just IP

## CORS
- [ ] `CORS_ORIGINS` is an explicit allow-list
- [ ] No wildcard (`*`) in production
- [ ] Preflight requests handled correctly

## File Uploads
- [ ] File size limits enforced
- [ ] File type validation (MIME + magic bytes)
- [ ] Uploaded files stored outside web root
- [ ] Virus scanning if handling user uploads

## Webhook Security
- [ ] WhatsApp signatures verified with `timingSafeEqual`
- [ ] Payment signatures verified (Billplz)
- [ ] Idempotency keys prevent duplicate processing
- [ ] Webhook endpoints return 200 even on business errors

## Payment Security
- [ ] Browser success redirect does NOT activate subscription
- [ ] Only verified provider webhooks activate subscriptions
- [ ] Webhook signatures verified before processing
- [ ] Idempotency on payment processing

## Secrets
- [ ] No secrets in Git (use `.env.example` with placeholders)
- [ ] Production secrets in managed store (AWS Secrets Manager, etc.)
- [ ] Database credentials rotated regularly
- [ ] JWT secrets rotated on security incident

## Dependency Vulnerabilities
- [ ] `npm audit` run and high/critical issues addressed
- [ ] Dependabot alerts monitored
- [ ] No unused dependencies

## Infrastructure
- [ ] HTTPS only (HSTS enabled)
- [ ] Security headers via Helmet
- [ ] Database not exposed to internet
- [ ] Redis not exposed to internet
- [ ] SSH key-based auth only (no passwords)

## Logging & Monitoring
- [ ] No PII in logs (emails, phone numbers, addresses)
- [ ] Audit logs for all mutations
- [ ] Failed auth attempts logged and alerted
- [ ] Suspicious activity patterns detected

## Review Date
Completed: ___________
Reviewer: ___________
