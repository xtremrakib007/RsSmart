# RsSmart POS — Malaysia readiness roadmap

This document separates the POS features that are visible in the current Android app from the work required before a shop can use it for live trading.

## Added in the current POS core-workflow branch

- Cashier login UI calls the backend `POST /auth/login` endpoint using email, password, and tenant ID.
- Fake fallback identities (`tenant-1` / `user-001`) are removed; a register cannot be opened against a pretend tenant.
- Shared session storage persists the authenticated tenant/user and bearer token; the sync HTTP client adds the bearer token.
- Backend URL can be set at build time using Gradle property `API_BASE_URL`, for example `-PAPI_BASE_URL=https://your-deployed-api.example/`.
- Opening and closing cash-up includes RM100, RM50, RM20, RM10, RM5, RM1, 50 sen, 20 sen, 10 sen and 5 sen counts.
- Barcode scanner is reachable from the catalogue, requests camera permission, and feeds the scanned code into search.
- Price-check mode shows product prices without adding items to a sale.
- POS cart, checkout, payment and printed receipt amounts use Malaysian Ringgit (RM).

## Required before a pilot shop

### Authentication and tenant safety
- Deploy the backend and set a real HTTPS `API_BASE_URL` for the release build.
- Create real company and cashier accounts; there are no shared/demo credentials in source control.
- Verify login, logout, role permissions, token expiry/refresh, tenant isolation and authenticated sync against a staging database.
- Store credentials/tokens using Android Keystore-backed encrypted storage before production rollout.
- Configure outlet and register/device assignment; do not permit staff to bypass login.

### Daily retail operations
- Product creation/import, product editing, categories, SKU/barcode validation and price changes with audit history.
- Inventory receiving, stock adjustments, stocktake, low-stock alerts and supplier/purchase orders.
- Customer directory, search, customer attachment to sales, customer receipts, returns and refund history.
- Cash, card, DuitNow QR, e-wallet and split-tender payment recording; integrate actual payment terminals/acquirers only after merchant onboarding.
- Discounts, manager approval for price overrides/voids/refunds, cashier permissions and audit logs.
- Thermal printer selection and test print, receipt reprint, cash-drawer kick and printer error recovery.
- End-of-day X/Z reports, sales by payment method, cashier/outlet reports, tax reports and cash variance.
- Offline checkout queue with conflict handling, idempotent sync and visible sync status. Do not claim a sale synced until the server confirms it.

### Malaysia-specific configuration
- Configure prices in RM and outlet-local date/time.
- Make SST/service tax settings configurable by business and item; do not hard-code a tax rate as universally applicable.
- Treat MyInvois e-Invoice as a separate integration: implement customer TIN/business data, invoice submission, validation status, rejection recovery, credit notes and duplicate-submission protection before claiming compliance.
- Treat DuitNow QR/card/e-wallet as payment channels that require merchant/acquirer setup; a displayed QR code or a manually recorded payment is not proof of settlement.
- Add Bahasa Malaysia/English labels, local phone/address fields and printable receipts with merchant details.

## Important current limitations

- A build using the default `https://api.retail.example.com/` URL is only a buildable placeholder and cannot authenticate to a real backend.
- This branch has not yet been validated against a deployed staging backend or physical barcode scanner/printer.
- Existing Room database configuration uses destructive migration fallback. Review and replace this before any production data is stored.
- Do not merge or use this branch for live sales until Android CI passes and staging end-to-end tests are completed.

## Official Malaysia references

- HASiL MyInvois e-POS overview: https://www.hasil.gov.my/en/myinvoisepos/mengenai-myinvois-e-pos/
- HASiL e-Invoice programme and implementation references: https://www.hasil.gov.my/e-invois/program-e-invois/
- Bank Negara Malaysia — DuitNow QR payments: https://www.bnm.gov.my/-/duitnow-qr-payments
