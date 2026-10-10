# RsSmart POS — Malaysia Production Feature Plan

This plan is the acceptance checklist for turning the current Android POS foundation into a usable Malaysian retail POS. A feature is not complete merely because a library, DAO, or screen file exists; it must be reachable from navigation, use the signed-in tenant, persist correctly, and pass tests on a real device.

## Already wired in this branch
- [x] RM denomination counting for opening and closing cash: RM100, RM50, RM20, RM10, RM5, RM1, 50 sen, 20 sen, 10 sen, 5 sen.
- [x] Camera barcode scanner is reachable from the product catalog.
- [x] Runtime camera permission prompt and manifest permission.
- [x] A scanned barcode is passed back into the catalog search; the product must exist in the current tenant catalog to appear.

## P0 — Required before pilot
- [ ] Real staff login and logout, using the backend's actual auth API; persist access/refresh tokens securely, handle expiry, and call `PosSessionProvider.setIdentity(tenantId, userId)` only from verified server claims. Remove the temporary `tenant-1` / `user-001` fallback before production. Never ship a universal demo password.
- [ ] Company/outlet/device selection after login, server-side role and permission enforcement, cashier PIN/manager override, lock screen, and audit trail for voids, discounts, refunds and price overrides.
- [ ] Make opening cash count mandatory before selling; save denomination counts as session evidence, not just the computed total. At close, show expected cash, counted cash, variance, cash-in/out and a cashier-readable Z report.
- [ ] Product lookup by barcode, SKU and name; price-check mode that does not add to cart; stock visibility; quick quantity/weight; variants and price tiers.
- [ ] Customer search/create/edit by name and Malaysian phone number (+60 normalization), optional email, loyalty/member number, customer-linked receipts and purchase history. Collect only necessary personal data.
- [ ] Checkout with cash, DuitNow QR through a contracted payment provider, supported card terminal/hosted terminal flow, e-wallets only where provider-approved, split tenders, change due, partial/failed payment recovery and idempotent order finalization. Do not collect or store raw card PAN/CVV in the app.
- [ ] Receipt printing settings and printer test for Bluetooth/USB ESC/POS 58mm and 80mm printers; selectable printer, paper width, business name/address/registration details, receipt number, timestamp, cashier, items, discounts, tax, tender breakdown, change and return policy. Provide a shareable digital receipt fallback.
- [ ] Offline-safe checkout and sync conflict handling; visible offline status, retry queue, no duplicate orders/payments after retries, and a clear sync-health screen.
- [ ] Add return/refund, item void, order cancellation, discounts with permission checks, cash in/out, shift report, sales history/reprint and end-of-day report to navigation.
- [ ] Automated tests for totals, rounding, tax, discounts, split payments, cash variance, session gating, duplicate submissions, tenant isolation and offline retry.

## P1 — Malaysia retail readiness
- [ ] Configure currency as MYR/RM per outlet, timezone Asia/Kuala_Lumpur, locale and receipt timestamps.
- [ ] Configurable tax engine and tax-inclusive/exclusive prices. Support SST/service-tax configuration only when applicable to the business, with effective dates and auditable tax codes. Do not hard-code a single tax rate or assume every retailer is SST-registered.
- [ ] Store company name, registered address and registration number, outlet details, receipt numbering, invoice/credit-note numbering, and exportable sales/tax reports. Have a Malaysian accountant validate the required invoice fields for the merchant's business and current rules.
- [ ] DuitNow QR must be integrated through the merchant's bank/acquirer/approved PSP. Show payment status from verified provider callbacks/API; never mark QR paid just because a customer says they paid.
- [ ] Barcode support: phone camera, external USB/Bluetooth HID scanner, GTIN/EAN/UPC and store-specific barcodes; manual entry fallback.
- [ ] Weighed goods and quantity precision, unit-of-measure support, price override approval and out-of-stock protection.
- [ ] Multi-outlet stock, purchase receiving, stock adjustment with reason, supplier and low-stock alerts.
- [ ] Customer consent and retention controls for loyalty/marketing, least-privilege access, encrypted transport/storage, backup/restore and audit export.
- [ ] Printer compatibility testing across actual devices and common 58mm/80mm ESC/POS printers.

## P2 — Operations and growth
- [ ] Promotions, vouchers, loyalty points with clear MYR accounting, gift cards/store credit, layaway where needed.
- [ ] Supplier purchasing, stock transfers, stocktake, wastage, expiry/batch tracking for relevant verticals.
- [ ] Multi-terminal register assignment, cashier performance, outlet comparison, product margin and inventory valuation reports.
- [ ] Optional accounting export and integrations, enabled only after credentials and tenant-level permissions are configured.

## Release gates
1. No production release while a default tenant/user identity can be used.
2. Never deploy database migrations to production until the migration chain is repaired and verified on a disposable staging database and a backup/rollback plan exists.
3. No real payment collection until the provider's sandbox tests, signature verification, idempotency and reconciliation tests pass.
4. Run Android build and unit tests, backend tests, and device tests for login, open shift, scan, price check, sale, receipt print, offline recovery and shift close.
5. The current branch is an incremental implementation, not a claim that every checklist item is finished.