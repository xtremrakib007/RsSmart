# RsSmart Tenant Payment and Direct Settlement Policy — DRAFT

## Intended model
RsSmart intends to offer one integrated checkout experience for tenant businesses using a payment provider that explicitly supports a marketplace/platform model and direct settlement to each tenant's approved merchant account or bank account.

Target flow:
1. Tenant completes merchant onboarding with the payment provider and links the approved account through the provider's supported process.
2. Customer selects products from that tenant's store or POS checkout.
3. Backend creates a payment session with the provider using a server-verified tenant-to-merchant mapping.
4. Provider processes the payment and settles according to its contract and settlement rules.
5. RsSmart receives a signed webhook, verifies it, updates the order/payment state idempotently, and records a reconciliation reference.
6. Refunds, chargebacks, disputes, fees, and settlement questions are handled according to the provider agreement and tenant responsibilities.

## Non-negotiable controls
- Do not route customer funds through an RsSmart-owned bank account or wallet if the stated model is direct settlement.
- Do not treat a browser/app success redirect as proof of payment; verify signed server-side provider events or query the provider.
- Do not trust merchant account IDs supplied by the client. Resolve them from a verified tenant configuration on the server.
- Verify webhook signatures, replay protection where supported, event idempotency, amount, currency, order, and tenant mapping.
- Do not store full card numbers or card security codes. Use provider-hosted checkout or tokenization.
- Keep subscription payments owed to RsSmart separate from tenant product-sales payments.
- Record fees, refunds, chargebacks, and settlement references for reconciliation without storing unnecessary sensitive data.

## Provider and legal confirmation
Before launch, obtain written confirmation from the chosen provider that one platform integration may onboard multiple independent Malaysian merchants and that funds can settle directly to each merchant. Confirm onboarding/KYC, supported payment methods, settlement timing, refunds, chargebacks, marketplace/platform fees, restricted businesses, and whether the provider's model creates any licensing or contractual obligations for RsSmart.

This is an intended design, not a guarantee of legal or provider approval. Do not advertise direct settlement as available until the provider contract and end-to-end tests confirm it. Obtain Malaysian legal advice on the actual contracts and fund flow.