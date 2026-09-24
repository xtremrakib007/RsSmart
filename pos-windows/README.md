# RsSmart-POS — Windows (Phase 5)

A **Tauri v2** desktop POS application for Windows, sharing business logic with the Android POS app.

## Architecture

```
┌─────────────────────────────────────────┐
│  React + TypeScript + Tailwind CSS      │  ← Frontend (UI)
│  Zustand (state management)             │
├─────────────────────────────────────────┤
│  Tauri v2 (Rust)                        │  ← Bridge + Native APIs
│  ├── SQLite (via tauri-plugin-sql)      │  ← Local database
│  ├── Sync Engine (background task)      │  ← Auto-sync every 5min
│  ├── ESC/POS Printer (USB/Serial)       │  ← Receipt printing
│  ├── Cash Drawer (ESC/POS kick)         │  ← Hardware control
│  ├── Barcode Scanner (USB HID)          │  ← Input device
│  ├── Weighing Scale (RS232)             │  ← Serial port
│  └── Auto-updater (tauri-plugin-updater)│  ← MSIX/NSIS updates
└─────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Lucide Icons |
| State | Zustand |
| Router | React Router v6 |
| Backend | Rust, Tauri v2 |
| Database | SQLite (tauri-plugin-sql) |
| HTTP | reqwest (Rust) |
| Serial | serialport-rs |
| USB | rusb |
| Printing | escpos-rs |
| Bundler | Vite |

## Project Structure

```
pos-windows/
├── src/                          # React frontend
│   ├── components/               # UI screens
│   │   ├── Layout.tsx            # App shell with nav
│   │   ├── SessionScreen.tsx     # Open/close day
│   │   ├── ProductCatalog.tsx    # Product grid + barcode
│   │   ├── CartScreen.tsx        # Cart management
│   │   ├── CheckoutScreen.tsx    # Order summary
│   │   ├── PaymentScreen.tsx     # Payment + receipt
│   │   ├── ReturnsScreen.tsx     # Refunds
│   │   └── SyncDashboard.tsx     # Offline queue monitor
│   ├── lib/
│   │   ├── store.ts              # Zustand POS state
│   │   └── tauri-api.ts          # Rust command wrappers
│   ├── types/
│   │   └── index.ts              # Shared TypeScript types
│   └── styles/
│       └── index.css             # Tailwind + custom utilities
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs               # Tauri app entry
│   │   ├── db/
│   │   │   ├── mod.rs            # SQLite init + schema
│   │   │   ├── models.rs         # Data structures
│   │   │   └── repository.rs     # CRUD + query layer
│   │   ├── api/
│   │   │   ├── session.rs        # Day open/close
│   │   │   ├── product.rs        # Catalog search
│   │   │   ├── order.rs          # Checkout
│   │   │   ├── payment.rs        # Payment recording
│   │   │   ├── refund.rs         # Returns
│   │   │   ├── sync.rs           # Queue + trigger
│   │   │   └── hardware.rs       # Printer, drawer, scale
│   │   ├── sync/
│   │   │   └── mod.rs            # Background sync loop
│   │   └── hardware/
│   │       ├── printer.rs        # ESC/POS + Windows spooler
│   │       ├── scale.rs          # RS232 weight reading
│   │       └── usb_devices.rs    # USB device enumeration
│   ├── Cargo.toml                # Rust dependencies
│   └── tauri.conf.json           # App config + updater
├── package.json                  # Node dependencies
├── vite.config.ts                # Vite + path aliases
└── tailwind.config.js            # Theme customization
```

## Setup

### Prerequisites
- **Node.js** 18+
- **Rust** 1.75+ (via rustup)
- **Windows SDK** (for MSIX/NSIS builds)
- **Visual Studio Build Tools** (for native compilation)

### Install
```bash
# 1. Clone / extract project
cd pos-windows

# 2. Install frontend dependencies
npm install

# 3. Install Tauri CLI
npm install -g @tauri-apps/cli

# 4. Run in dev mode
npm run tauri:dev

# 5. Build for production
npm run tauri:build
```

### Database
SQLite is auto-initialized on first run. The schema mirrors the Android Room database:
- `products` — catalog with barcode/SKU indexing
- `pos_sessions` — day open/close with cash tracking
- `pos_orders` — transaction records
- `payments` — payment methods (cash, card, mobile, split)
- `offline_queue` — pending sync items with retry logic

### Hardware Support

| Device | Protocol | Status |
|--------|----------|--------|
| Thermal Printer | ESC/POS (USB) | ✅ |
| Cash Drawer | ESC/POS kick command | ✅ |
| Barcode Scanner | USB HID (keyboard emulation) | ✅ |
| Weighing Scale | RS232 (Mettler Toledo / A&D) | ✅ |
| Label Printer | ZPL (future) | 🔄 |

### Sync Engine
- **Background sync** every 5 minutes via Tokio interval
- **Exponential backoff** on failure (max 5 retries)
- **Offline queue** with priority ordering
- **Auto-prune** completed/failed items
- **Manual trigger** from Sync Dashboard
- Requires the `RSSMART_API_BASE_URL` environment variable to be set to the backend's
  base URL before sync will run (e.g. `https://api.yourdomain.com`). Sync attempts
  fail fast with a clear error if it's unset, instead of silently posting to a
  placeholder domain.

### Branding
Each company's installed copy of this app can show its own name in the title bar
instead of "RsSmart-POS", via environment variables set at deployment time:
- `RSSMART_BRAND_NAME` — company display name (defaults to "RsSmart-POS")
- `RSSMART_BRAND_LOGO_URL` / `RSSMART_BRAND_COLOR` — optional, for future use in the UI

### Auto-Updater
Configure in `tauri.conf.json`:
```json
"plugins": {
  "updater": {
    "pubkey": "YOUR_ED25519_PUBLIC_KEY",
    "endpoints": ["https://your-cdn.com/updates/windows"]
  }
}
```

Build targets: `msi`, `nsis` (installer with WebView2 bootstrapper).

## Key Features

- [x] Tauri v2 project setup
- [x] Shared business logic (mirrors Android POS)
- [x] Same POS features: catalog, cart, checkout, payment
- [x] Windows-specific hardware drivers (USB/Serial)
- [x] ESC/POS receipt printing
- [x] Cash drawer integration
- [x] RS232 weighing scale support
- [x] Auto-updater (Squirrel/NSIS)
- [x] Offline mode with SQLite queue
- [x] Sync monitoring dashboard

## Next Steps (Phase 6 Prep)
- Add ZPL label printer support
- Integrate Windows biometric/card reader
- Excel/PDF export for reports
- Multi-window support (customer display)
- Touchscreen optimization
