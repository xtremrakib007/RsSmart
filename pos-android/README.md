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
1. Open in Android Studio Hedgehog or later and sync Gradle.
2. Deploy the RsSmart NestJS backend and configure its database, JWT secrets, and HTTPS URL first.
3. Set the backend origin when building: `RSSMART_API_BASE_URL=https://your-api-host.example/` in the build environment, or pass `-PrssmartApiBaseUrl=https://your-api-host.example/` to Gradle. The URL must be the origin/root URL and must end with `/`.
4. The staff login requires the backend's company tenant ID, email, and password. There are no safe hard-coded demo credentials.
5. Run on Android 8+; grant camera permission for barcode scanning and pair a compatible ESC/POS printer for receipt printing.
6. The CI build uses a placeholder API URL unless the workflow is configured with the deployed URL, so that APK cannot sign in until configured.

## Malaysian retail workflow notes
- Cashier sign-in is the first screen; a shift cannot be opened using placeholder tenant/user identities.
- Opening and closing float counts support RM100, RM50, RM20, RM10, RM5, RM1 notes and 50/20/10/5 sen coins.
- Prices are shown in Malaysian ringgit (RM).
- The barcode button opens CameraX/ML Kit scanning and returns the scanned value to the product/price search.
- DuitNow QR and card terminal transactions must not be marked paid merely because the cashier selected a method. Connect an approved provider/terminal and verify its payment result before production use.
- MyInvois/e-Invoice, SST rules, receipt numbering, and company tax details must be configured and verified against the merchant's actual obligations before production use.

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
