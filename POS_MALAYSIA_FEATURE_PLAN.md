# RsSmart POS — Malaysia Retail Feature Plan

This file is the implementation checklist for completing the Android POS. A feature is not production-ready merely because a screen exists; it must be connected to the canonical NestJS API, tenant-aware data, persistence, permissions, error handling and tests.

## Malaysia-specific requirements

- All prices, receipts, cash counts, reports and payment amounts use MYR (RM), with two decimal places for money.
- Payment methods: cash, DuitNow QR, debit/credit card through a merchant-approved terminal/provider, and mixed tender. Never store raw card numbers, CVV or PIN.
- Configurable tax/SST rules by business and effective date; tax defaults must be confirmed by the business/accountant before production.
- Receipts support merchant legal name/address/registration details, outlet, cashier, timestamp, receipt number, itemized discounts/tax, payment split and return reference.
- Support EAN/UPC barcode scanning, manual SKU/barcode entry, PLU lookup and variable-weight products.
- Bluetooth/USB ESC/POS printers (58mm/80mm), scanner hardware keyboard input, and supported weighing-scale adapters.
- Tenant/outlet/staff permissions, shift audit trail, offline-safe transactions and conflict-aware synchronization.
- Plan an integration boundary for Malaysia e-Invoice/MyInvois; do not claim compliance until LHDN requirements and production credentials are validated.

## Status on this branch

- [x] Opening shift counts Malaysian notes and coins: RM100, RM50, RM20, RM10, RM5, RM1, 50 sen, 20 sen, 10 sen and 5 sen.
- [x] Opening count total is calculated in RM and the denomination breakdown is retained in shift notes.
- [x] Closing shift counts notes and coins and displays expected cash and the cash difference.
- [x] Price-check screen searches the local tenant catalog by product name, SKU or barcode and displays price/stock.
- [x] Barcode scanner is reachable from the catalog and price-check screens, requests Android camera permission and fills the search field with the scanned value.
- [x] Existing returns/refunds screen is reachable from the catalog.
- [x] Existing cart, checkout, payment completion and receipt-print flow remains in the navigation.
- [ ] Real staff login, logout, refresh-token handling and role permissions. Backend endpoint exists, but the POS currently has no deployed API base URL configured; do not use demo credentials or hardcoded identities in production.
- [ ] Remove fallback 'tenant-1' / 'user-001' identity and require authenticated tenant/user identity before opening a shift.
- [ ] Customer directory, customer selection, loyalty/member ID and customer-specific price/discount.
- [ ] Product catalog import/sync and visible empty/loading/error states.
- [ ] Quantity/weight/PLU entry, item-level discount, manager-approved void/discount and suspended sale recall.
- [ ] Cash/card/DuitNow QR/split-tender payment recording and payment-provider reconciliation.
- [ ] Searchable sales history, receipt reprint, return-to-original-sale validation and refund audit.
- [ ] Cash in/out, paid-in/paid-out reason codes, safe drops and complete end-of-day report.
- [ ] Printer selection/test page, barcode-label printing and weighing-scale adapters.
- [ ] Inventory receiving, stock adjustments, low-stock warnings and stocktake.
- [ ] E-invoice/MyInvois integration after business registration, tax workflow and credentials are confirmed.
- [ ] Automated tests for shift cash arithmetic, barcode search, checkout totals, returns, permissions and offline sync.

## Release gates

1. Configure and deploy the canonical NestJS backend and PostgreSQL database in a non-production environment.
2. Configure the POS API base URL and implement real authentication before removing the temporary identity fallback.
3. Run Android debug build, unit tests and end-to-end workflow tests on a physical device.
4. Verify tenant isolation, permission enforcement, offline retry/idempotency and audit trails.
5. Test actual Malaysian receipt printer, scanner, DuitNow/card provider, tax setup and business receipt details.
6. Only then create a signed release build. CI debug APKs are for testing, not Play Store release.
