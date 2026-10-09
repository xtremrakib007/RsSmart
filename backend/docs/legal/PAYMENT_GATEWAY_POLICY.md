# RsSmart Payment Gateway and Direct Settlement Policy

**DRAFT — provider approval and legal review required.**

## Intended model
RsSmart intends one approved payment integration for multiple tenant businesses, with customer payments settled directly by the provider to each tenant's designated bank account. RsSmart intends to collect its own SaaS subscription fees separately and not receive, pool or hold tenant sale proceeds.

## Provider approval is mandatory
This design is possible only if a provider expressly approves the platform/marketplace use case and supports merchant onboarding, connected accounts, direct settlement, refunds, chargebacks and reconciliation in Malaysia. An ordinary merchant account/API does not automatically support marketplace processing. Obtain written approval and execute the correct provider agreement before enabling live transactions.

## Intended flow
1. Tenant completes provider merchant verification.
2. Checkout identifies the tenant as seller in the provider-approved flow.
3. Customer pays through the provider.
4. Provider settles to the tenant according to its agreement and risk controls.
5. RsSmart receives necessary transaction IDs/status webhooks and updates the order.
6. Tenant and provider handle fulfilment, refunds, disputes and settlement under their agreements.

## Restrictions and security
RsSmart must not route proceeds through its own bank account or promise settlement timing unless an approved legal/provider structure expressly permits it. Use hosted checkout or approved tokenization; never store full card data or CVV/CVC. Verify webhook signatures, reject replay, process idempotently, and do not mark orders paid based only on browser redirects.

## Responsibilities and launch checks
Tenants must provide accurate merchant details, complete onboarding, sell lawful goods, disclose terms/prices, fulfil orders and handle customer support and applicable tax/refund duties. Disclose fees and dispute allocation. Before launch, obtain written provider approval; ask Malaysian counsel whether the actual role triggers registration, licensing or other obligations; and test onboarding, payment failures, duplicate webhooks, refunds, disputes and reconciliation.

This is an intended architecture only, not proof that a provider is selected, approval obtained or production integration exists.
