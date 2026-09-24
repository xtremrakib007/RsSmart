# RsSmart-ERP — Windows (Phase 6)

A comprehensive back-office ERP built with **Tauri v2** + **React** + **TypeScript** + **AG Grid**.

## Features

| Module | Features |
|--------|----------|
| **Dashboard** | KPI widgets, sales charts (Recharts), stock alerts, recent activity |
| **Inventory** | AG Grid data grid, product CRUD, stock movements, low-stock alerts |
| **Purchasing** | Purchase orders, multi-item POs, status workflow (Draft → Sent → Received) |
| **Accounting** | Chart of accounts, double-entry journal, balanced posting |
| **HR/Users** | Role-based users, permissions, activation toggle |
| **Reports** | Filter builder, Excel/PDF export |
| **Audit** | Full activity log with before/after diff viewer |
| **Approvals** | Pending request queue, approve/reject with comments |
| **Sync** | Device health monitoring, latency tracking |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, AG Grid, Recharts, Zustand |
| Backend | Rust, Tauri v2, SQLite (tauri-plugin-sql) |
| Export | CSV generation via Rust `csv` crate |

## Branding
Each company's installed copy of this app can show its own name in the sidebar
instead of "RsSmart-ERP", via environment variables set at deployment time:
- `RSSMART_BRAND_NAME` — company display name (defaults to "RsSmart-ERP")
- `RSSMART_BRAND_LOGO_URL` / `RSSMART_BRAND_COLOR` — optional, for future use in the UI

## Build

```bash
cd erp-windows
npm install
npm run tauri:dev
```

## Project Structure

```
erp-windows/
├── src/                          # React frontend
│   ├── components/
│   │   ├── dashboard/            # KPI cards, charts, alerts
│   │   ├── inventory/            # AG Grid product manager
│   │   ├── purchasing/           # PO list + create modal
│   │   ├── accounting/           # COA + journal entries
│   │   ├── hr/                   # User cards + roles
│   │   ├── reports/              # Filter builder + export
│   │   ├── audit/                # Log table + detail modal
│   │   ├── approvals/            # Approval queue
│   │   └── sync/                 # Device health cards
│   ├── lib/
│   │   ├── store.ts              # Zustand ERP state
│   │   └── tauri-api.ts          # Rust command wrappers
│   └── types/
│       └── index.ts              # Shared TypeScript types
└── src-tauri/                    # Rust backend
    ├── src/
    │   ├── main.rs               # Tauri app + command router
    │   ├── db/                   # SQLite schema + models + repository
    │   ├── api/                  # Command handlers per module
    │   ├── export/               # CSV/Excel generation
    │   └── sync/                 # Background sync loop
    └── Cargo.toml
```
