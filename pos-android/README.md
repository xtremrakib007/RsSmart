# RsSmart-POS — Android (Phase 4)

## Architecture
- **Shared Library** (`:shared`) — Reusable across Sales App and POS App
  - Room Database with entities: Product, CartItem, PosSession, Payment, PosOrder, OfflineQueueItem
  - Sync engine with WorkManager + exponential backoff
  - Retrofit API client for server communication
- **POS App** (`:app`) — Jetpack Compose + MVVM + Hilt
  - Session management (open/close day)
  - Product catalog with search
  - Cart & checkout flow
  - Payment handling (cash, card, split)
  - Receipt printing via ESC/POS
  - Returns & refunds
  - Offline queue with auto-sync

## Tech Stack
| Layer | Technology |
|-------|-----------|
| UI | Jetpack Compose, Material3 |
| DI | Hilt |
| DB | Room |
| Networking | Retrofit + OkHttp |
| Sync | WorkManager + BullMQ (server) |
| Printing | ESCPOS-ThermalPrinter-Android |
| Barcode | CameraX + ML Kit |
| Offline | SQLite queue + retry logic |

## Project Structure
```
pos-android/
├── shared/               # Shared Kotlin library
│   ├── data/local/       # Room entities & DAOs
│   ├── data/remote/      # Retrofit APIs
│   ├── sync/             # SyncWorker, SyncManager
│   └── di/               # Hilt modules
└── app/                  # POS Android app
    ├── ui/               # Compose screens
    ├── viewmodel/        # MVVM ViewModels
    ├── service/          # Printer, Hardware, Offline
    └── di/               # App-level DI
```

## Setup
1. Open in Android Studio Hedgehog or later
2. Sync Gradle
3. Update `SyncApi` base URL in `SharedModule.kt`
4. Run on Android 8+ device with USB/Bluetooth printer for full features

## Key Features Implemented
- [x] Shared Kotlin library with Sales App
- [x] Product catalog with search
- [x] Cart & checkout flow
- [x] Payment handling (structure for cash/card/split)
- [x] Receipt printing (ESC/POS via USB/Bluetooth)
- [x] Day open/close session with cash tracking
- [x] Returns & refunds
- [x] Offline mode with queue + retry
- [x] Hardware abstraction layer (USB device classification)
- [x] Barcode scanning (CameraX + ML Kit)

## Next Steps (Phase 5 Prep)
- Integrate actual tenant/user auth from Sales App
- Add split payment UI
- Implement card reader integration (Stripe/ Square SDK)
- Add weighing scale RS232 support
- Windows POS app (Tauri/Electron) sharing business logic
