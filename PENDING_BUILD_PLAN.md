# Pending Build Plan

## Phase 1: Backend Core Completion ✅ (COMPLETE)
- [x] Seed data script (`prisma/seed.ts`)
- [x] Inventory module (stock movements, adjustments)
- [x] POS Session module (open/close day, cash drawer)
- [x] Payment module enhancements (split payments, refunds)
- [x] WebSocket gateway for real-time notifications
- [x] File upload service (MinIO integration)
- [x] Report generation endpoints (sales, inventory, collections)
- [x] API rate limiting
- [x] Request/response logging middleware

## Phase 2: Sync Engine Hardening ✅ (COMPLETE)
- [x] Async sync event processing (BullMQ + Redis)
- [x] Conflict resolution service (duplicate, stock, version)
- [x] Sync health dashboard (device stats, alerts, retry)
- [x] Delta sync (only changed fields)
- [x] Sync retry with exponential backoff (5 attempts)
- [x] Client-side SQLite schema migrations (Room DB)
- [x] End-to-end sync testing

## Phase 3: Sales App - Android ✅ (COMPLETE)
- [x] Kotlin + Jetpack Compose project setup
- [x] Room Database schema (mirror server subset)
- [x] Offline sync client SDK
- [x] Login & tenant selection
- [x] Customer list with search
- [x] Customer detail & visit recording
- [x] GPS tracking & geofencing
- [x] Order taking (cart, products, pricing)
- [x] Collection recording with photo capture
- [x] Expense reporting with receipt OCR
- [x] Target/KPI dashboard
- [x] Background sync with WorkManager

## Phase 4: POS - Android (Weeks 5-6)
- [ ] Shared Kotlin library with Sales App
- [ ] Product catalog with barcode scanning
- [ ] Cart & checkout flow
- [ ] Payment handling (cash, card, split)
- [ ] Receipt printing (ESC/POS)
- [ ] Cash drawer integration
- [ ] Day open/close session
- [ ] Returns & refunds
- [ ] Offline mode with queue
- [ ] Hardware abstraction layer

## Phase 5: POS - Windows (Weeks 6-7)
- [ ] Tauri or Electron project setup
- [ ] Shared business logic (Rust or TS)
- [ ] Same POS features as Android
- [ ] Windows-specific hardware drivers
- [ ] Auto-updater (Squirrel or MSIX)
- [ ] Label printer support (ZPL)
- [ ] Weighing scale integration (RS232)

## Phase 6: ERP - Windows (Weeks 7-9)
- [ ] Tauri/Electron + React/Vue setup
- [ ] Dashboard with KPI widgets
- [ ] Advanced data grids (AG Grid)
- [ ] Product & inventory management
- [ ] Purchase orders
- [ ] Accounting module (chart of accounts, journals)
- [ ] HR/User management
- [ ] Report builder with filters
- [ ] Approval workflow UI
- [ ] Audit log viewer
- [ ] Sync monitoring dashboard
- [ ] Excel/PDF export

## Phase 7: Infrastructure & DevOps (Weeks 9-10)
- [ ] Production Docker Compose / K8s manifests
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Nginx reverse proxy with SSL
- [ ] PostgreSQL read replicas
- [ ] Redis caching layer
- [ ] Sentry error tracking
- [ ] Prometheus + Grafana monitoring
- [ ] Log aggregation (Loki/ELK)
- [ ] Backup automation
- [ ] Load testing (k6/Artillery)

## Phase 8: Polish & Scale (Ongoing)
- [ ] Mobile app distribution (Firebase/Play Console)
- [ ] Windows app code signing
- [ ] Multi-language support (i18n)
- [ ] Dark mode
- [ ] Push notifications
- [ ] Email/SMS integration
- [ ] BI dashboard (Metabase/Superset)
- [ ] Mobile app performance optimization
- [ ] Security audit (OWASP)
- [ ] Penetration testing
