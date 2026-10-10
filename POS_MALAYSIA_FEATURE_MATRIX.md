# RsSmart POS — Malaysian Retail Feature Matrix

This is the implementation and release checklist for the Android POS. A visible screen is not considered complete until it is connected to persistent data, backend authorization, audit records, error handling, and tests.

## Available in the Android client
- [x] Staff sign-in screen calling the NestJS `POST /api/auth/login` endpoint (requires a deployed backend URL and an existing company user).
- [x] Remove hard-coded tenant/user fallback identities; opening a shift rejects blank identity.
- [x] Opening cash count by Malaysian notes and coins; automatically totals to RM.
- [x] Closing cash count by Malaysian notes and coins.
- [x] Continue into the register when a shift is already open.
- [x] Camera permission request and barcode scanning route wired into product search.
- [x] Product/price lookup by name, SKU, or barcode and RM price display.
- [x] Existing cart, checkout, payment-completion, receipt printing, and return/refund screens remain in the app.

## Required before production rollout
- [ ] Deploy backend and set `RSSMART_API_BASE_URL` or Gradle property `rssmartApiBaseUrl`; verify login and refresh-token expiry/revocation on a real staging tenant.
- [ ] Implement secure logout, token refresh, session timeout, PIN re-authentication for manager overrides, and device/outlet selection.
- [ ] Enforce role/permission checks for voids, discounts, price overrides, returns, refunds, cash movements, and shift closing in the backend.
- [ ] Persist opening/closing denomination detail as structured server records (currently included in session notes); store cash-only sales separately from non-cash sales so expected drawer cash is accurate.
- [ ] Finish authenticated product/customer/supplier/stock APIs and sync them into the offline Room database.
- [ ] Add customer search/create, customer purchase history, loyalty/points only if merchant enables them, and customer-specific tax/invoice details.
- [ ] Add quantity by weight, PLU items, variants, weighed-barcode parsing, age/controlled-item prompts where relevant, price overrides with audit, promotions, vouchers, and suspended/recall sales.
- [ ] Add explicit split-tender allocation and reconciliation. Cash, DuitNow QR, bank transfer, and card must have separate payment states and references.
- [ ] Integrate an approved DuitNow QR/acquirer and card terminal provider; verify signed/provider-confirmed outcomes. Do not treat a generated QR or selected method as successful payment.
- [ ] Add receipt configuration (merchant identity, address, SSM/TIN/SST details as applicable), sequential receipt numbers, reprint audit, refund/credit-note links, and print templates.
- [ ] Add label/barcode printing, USB/Bluetooth printer discovery/selection, printer diagnostics, cash-drawer kick, and supported weighing-scale adapters.
- [ ] Add purchase orders, goods receiving, supplier returns, stock counts, transfers, wastage, reorder levels, and negative-stock policy.
- [ ] Add shift close report with cash sales, non-cash sales, refunds, cash-in/out, expected cash, counted cash, variance reason, and manager approval.
- [ ] Add daily/monthly sales, product/category, gross margin, tax, tender, cashier, and outlet reports.
- [ ] Implement durable offline order IDs/idempotency, retry/backoff, conflict handling, duplicate prevention, and visible sync status.
- [ ] Implement MyInvois/e-Invoice integration and configurable SST/tax rules only after merchant obligations and current HASiL guidance are verified.
- [ ] Add backend integration tests, Android UI tests, tenant-isolation tests, payment failure tests, printer tests, backup/restore, and end-to-end staging validation.

## Malaysia-specific release safeguards
- Currency defaults to RM; do not hard-code a universal tax rate. Taxability/rates must be configurable by item and merchant, with exemptions handled deliberately.
- DuitNow QR and cards require a real approved payment integration; the POS UI cannot independently confirm settlement.
- e-Invoice eligibility, consolidated invoice handling, invoice fields, SST, and retention vary by business and current rules. Obtain accountant/tax/legal review and test against the official MyInvois integration before claiming compliance.
- Keep production API URLs, credentials, JWT secrets, payment keys, and certificates in deployment secrets. Never commit them to Git.

## Build configuration
The default API URL intentionally points to a placeholder and the login button stays disabled. For a staging build, set a real HTTPS backend origin via `RSSMART_API_BASE_URL` or `-PrssmartApiBaseUrl=https://your-api-host/`. Do not ship a production APK until the configured URL and end-to-end auth/payment flows have been tested.
