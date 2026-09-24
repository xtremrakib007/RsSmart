# RsSmart Pilot Onboarding Runbook

## Phase 37 — Pilot Company #1

### Pre-Flight Checklist

```
□ Staging environment is up (docker-compose.prod.yml or K8s staging overlay)
□ Database migrated to latest (prisma migrate deploy)
□ Redis is reachable and has no password in staging / password set in prod
□ SubscriptionPlan seeded with 'starter' slug (DEFAULT_TRIAL_PLAN_SLUG)
□ Payment provider sandbox credentials configured (Billplz test mode)
□ WhatsApp Meta Cloud test number registered and connected
□ Monitoring stack running (Prometheus scraping /metrics, alerts configured)
□ Backup script tested and verified (scripts/backup-postgres.sh)
□ CI/CD pipeline green on main branch
□ SENTRY_DSN configured for error tracking
□ CORS_ORIGINS includes pilot company domain(s)
```

### Onboarding Steps

1. **Create company via signup flow**
   ```bash
   curl -X POST https://staging.api.rssmart.com/auth/register-company \
     -H "Content-Type: application/json" \
     -d '{
       "companyName": "Pilot Company #1",
       "email": "owner@pilot1.com",
       "password": "...",
       "firstName": "Pilot",
       "lastName": "Owner",
       "phone": "+60..."
     }'
   ```
   - Verify trial subscription auto-created (`GET /subscriptions/current`)
   - Verify owner user has `admin` role
   - Verify first outlet is auto-created

2. **Configure WhatsApp**
   - Connect WhatsApp Business Account via `POST /whatsapp/accounts`
   - Verify webhook signature with test message
   - Send test template message

3. **Add staff**
   - Owner invites manager via `POST /invitations`
   - Manager accepts and logs in
   - Verify outlet scoping works (manager can only see assigned outlets)

4. **Load catalog**
   - Create categories, units, products
   - Set initial stock via `POST /inventory/adjustments`

5. **POS smoke test**
   - Open POS session (`POST /pos-sessions`)
   - Create sale with `clientTransactionId`
   - Verify inventory deducted
   - Retry same `clientTransactionId` → expect 409

6. **Payment smoke test**
   - Create subscription checkout (`POST /payments/checkout`)
   - Complete sandbox payment
   - Verify webhook activates subscription
   - Verify billing history shows invoice

### Monitoring During Pilot

Watch these dashboards/alerts:
- API error rate > 1%
- API p95 latency > 500ms
- Database connection pool saturation
- Redis memory usage
- WhatsApp message failure rate
- Payment webhook failure rate
- Failed sync events queue depth

### Daily Checklist (Pilot Period)

```
□ Review error logs (Sentry / CloudWatch)
□ Check backup completion
□ Verify subscription statuses (no unexpected expired trials)
□ Review failed WhatsApp messages (GET /whatsapp/failed-messages)
□ Check for cross-tenant data leakage (audit logs)
□ Confirm POS sales reconcile with inventory
```

---

## Phase 38 — Pilot Companies #2–3

### Goal: Validate with different company profiles

| Company | Size | Outlets | Staff | Sales Volume | Workflow |
|---------|------|---------|-------|-------------|----------|
| #1 | Small | 1 | 3 | Low | Standard retail |
| #2 | Medium | 3 | 12 | Medium | Multi-outlet + delivery |
| #3 | Medium | 2 | 8 | Medium | Wholesale + POS |

### Validation Points
- [ ] Different outlet counts stay within plan limits
- [ ] Offline sync works across all devices
- [ ] Inventory concurrency holds under real load
- [ ] WhatsApp campaigns send without rate-limit issues
- [ ] Payment webhooks reliable across all tenants
- [ ] No cross-tenant data access in any scenario
- [ ] Subscription enforcement blocks over-limit actions

---

## Phase 39 — Paid Launch: 5 Companies

### Readiness Gate

```
□ All Phase 38 pilots completed without critical issues
□ Billing flow tested end-to-end with real payments (small amounts)
□ Support process documented (escalation path, SLA)
□ Onboarding documentation written for self-service signup
□ Plan upgrade/downgrade flow tested
□ Cancellation and data export procedure documented
□ Monitoring alerts tuned (no false positives)
□ Runbook for common issues (password reset, subscription issues, etc.)
```

### Launch Sequence
1. Soft launch: invite-only, manual onboarding assistance
2. Monitor for 48 hours
3. Open self-service signup if stable

---

## Phase 40 — Paid Launch: 10–20+ Companies

### Capacity Checks

Before increasing beyond 5 companies, verify:

| Resource | Check | Threshold |
|----------|-------|-----------|
| Database | Slow query log | p95 < 100ms |
| Database | Connection pool | < 80% utilization |
| Redis | Memory | < 70% of instance |
| Redis | Eviction rate | Zero |
| API | p99 latency | < 1s |
| API | Error rate | < 0.5% |
| WhatsApp | Queue depth | < 1000 pending |
| Payments | Webhook delivery | > 99.9% success |
| Backups | Size / duration | < 4 hours, < 50GB |
| Support | Tickets per company | < 2/week |

### Scaling Actions (if thresholds breached)
- DB: Add read replica for reporting queries
- API: Increase HPA replica count (K8s) or instance size
- Redis: Upgrade to cluster mode or larger instance
- WhatsApp: Add queue workers
- Backups: Enable incremental backups, test restore speed

---

## Phase 41 — Scale Preparation

### Optimization Checklist

Only optimize based on **real production metrics**:

```
□ Identify top 10 slow queries (pg_stat_statements)
□ Add missing indexes where query time > 100ms
□ Move report generation to background jobs (BullMQ)
□ Add Redis caching for hot reads (subscription status, plan limits)
□ Review DB connection pool sizing
□ Consider read replica for analytics/reporting workloads
□ Queue worker scaling: monitor BullMQ queue depths
□ Asset CDN for frontend static files
□ Database partitioning strategy for high-volume tables (orders, pos_transactions)
```

### Do NOT Do (Premature Optimization)
- Microservices split
- Complex event sourcing
- Multi-region deployment (unless latency > 300ms for target market)
- Custom queue system (BullMQ is sufficient)
- Separate read/write DB routing (unless read replica proven needed)

---

## Emergency Procedures

### Database Corruption
1. Stop all API pods: `kubectl scale deployment api --replicas=0`
2. Restore from latest backup: `scripts/restore-postgres.sh`
3. Verify data integrity with `prisma validate`
4. Scale API back up: `kubectl scale deployment api --replicas=3`
5. Notify affected tenants via email/WhatsApp

### Security Incident (Suspected Data Breach)
1. Rotate JWT secrets immediately
2. Force password reset for all users in affected tenant(s)
3. Audit logs: `SELECT * FROM audit_logs WHERE tenantId = '...' ORDER BY createdAt DESC`
4. Preserve evidence, do not delete logs
5. Notify within 72 hours per PDPA/GDPR obligations

### Payment Provider Outage
1. Switch to mock provider mode (env: `PAYMENT_PROVIDER=mock`)
2. Queue subscription activations for manual processing
3. Notify tenants of temporary billing suspension
4. Monitor provider status page
5. Re-process queued activations when provider recovers

### WhatsApp Provider Outage
1. Failed messages auto-retry (Phase 30) — monitor `GET /whatsapp/failed-messages`
2. If outage > 4 hours, pause campaign sends
3. Notify tenants via email fallback
4. Resume when Meta status page shows green
