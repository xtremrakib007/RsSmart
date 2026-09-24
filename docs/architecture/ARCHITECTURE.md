# System Architecture

## Layers
- Central Backend (NestJS)
- Central Database (PostgreSQL)
- 3 Client Apps: Sales App (Android), ERP (Windows), POS (Android+Windows)

## Key Patterns
- Multi-tenancy: tenant_id on every table
- Offline-first: SQLite local + event sync
- RBAC: Role-based access control
- Audit: Immutable activity logs
