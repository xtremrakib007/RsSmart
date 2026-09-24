# Phase 41 — Scale Preparation Checklist

> Only optimize based on real production metrics. Do not prematurely introduce
> microservices or complex infrastructure.

## Database

- [ ] Enable `pg_stat_statements` extension and review top 10 slow queries weekly
- [ ] Add composite indexes for common query patterns (e.g. `orders` by `tenantId+createdAt`)
- [ ] Partition high-volume tables when row count > 10M:
  - `pos_transactions` — by `createdAt` (monthly)
  - `orders` — by `tenantId` (hash) or `createdAt` (range)
  - `sync_events` — by `createdAt` (weekly, TTL 90 days)
- [ ] Set up read replica for reporting/analytics queries
- [ ] Connection pool: PgBouncer if direct connections > 200

## Caching

- [ ] Cache subscription plan limits in Redis (TTL: 5 min)
- [ ] Cache tenant settings in Redis (TTL: 1 min)
- [ ] Cache hot product catalogs per outlet (TTL: 10 min)
- [ ] Add cache invalidation on write (subscription change, product update)

## Background Jobs

- [ ] Move report generation to BullMQ workers (not API threads)
- [ ] Move WhatsApp campaign sends to dedicated queue workers
- [ ] Move inventory reconciliation to nightly cron job
- [ ] Monitor queue depths and scale workers horizontally

## API Performance

- [ ] Add response compression for large payloads (`compression` middleware already present)
- [ ] Paginate all list endpoints with max page size (100)
- [ ] Add request timeout middleware (30s default)
- [ ] Rate limit by tenantId, not just IP (prevent one tenant from saturating)

## Frontend / Static Assets

- [ ] Serve frontend builds from CDN (CloudFront / Cloudflare)
- [ ] Enable gzip/brotli for API responses
- [ ] Lazy-load heavy dashboard components

## Infrastructure

- [ ] K8s HPA: scale on CPU + request latency (not just CPU)
- [ ] Add pod disruption budgets for zero-downtime deployments
- [ ] Blue-green or rolling deployment strategy
- [ ] Database: automated failover with patroni or managed RDS
- [ ] Redis: cluster mode or managed ElastiCache

## Monitoring Depth

- [ ] Add custom metrics:
  - `rssmart_pos_sale_total` (counter, labels: tenantId, outletId, paymentMethod)
  - `rssmart_inventory_adjustment_total` (counter)
  - `rssmart_subscription_change_total` (counter, labels: fromStatus, toStatus)
  - `rssmart_whatsapp_message_duration_seconds` (histogram)
  - `rssmart_sync_event_processing_duration_seconds` (histogram)
- [ ] Set up Grafana dashboards for:
  - API overview (RPS, latency, errors)
  - Business overview (sales, active tenants, subscription distribution)
  - Infrastructure (DB, Redis, queue depths)
  - Security (failed auth attempts, cross-tenant access attempts)

## Support Scaling

- [ ] Document FAQ for self-service support
- [ ] Add in-app error reporting (Sentry user feedback)
- [ ] Automate common fixes (retry failed webhooks, re-sync stuck devices)

## Target: 50–100+ Companies

Before hitting 50 active companies, verify all items above are green.
After 50, re-evaluate architecture — but only if metrics prove a bottleneck.
