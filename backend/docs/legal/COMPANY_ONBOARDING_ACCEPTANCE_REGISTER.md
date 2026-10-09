# Company Onboarding and Subscription Policy Acceptance Register

**Implementation requirements — not evidence that these controls are currently implemented.** Use this as the build specification for company account opening and subscription checkout.

## Required customer flow

### Company account opening
Before a company account is submitted, show a checklist with links to the full, current documents. Required checkboxes must start unchecked:
- [ ] Terms and Conditions — explicit acceptance.
- [ ] Privacy Policy — acknowledgement that the notice was presented and read/available, with wording approved by Malaysian counsel.
- [ ] Acceptable Use Policy — acceptance where counsel determines it is contractual.
- [ ] Data Protection / Data Processing terms — as applicable to the customer relationship and role.
- [ ] Payment Gateway and Direct Settlement Policy — if payment processing/settlement features are enabled.
- [ ] Any additional legally required company declarations, clearly separated from optional marketing consent.

Do not make optional marketing consent a condition of opening an account. Do not label a policy as “accepted” if the action only records that it was displayed.

### Subscription purchase or renewal
Before confirming a subscription, display the selected plan, price, billing frequency, renewal and cancellation conditions, and the applicable Subscription Agreement. Require affirmative acceptance and block checkout completion until the server verifies it.

### Policy updates
Policies must have immutable version identifiers and publication/effective dates. When an updated version requires fresh acceptance, prompt the customer and preserve all previous records. Do not overwrite historic acceptance.

## Evidence to retain

For every individual acceptance/acknowledgement, store a server-side record with:
- Company/tenant ID and account ID.
- Accepting user's ID and the user's company role at the time.
- Policy identifier, version, publication/effective date, and action type.
- Server-generated UTC timestamp.
- Immutable policy revision reference and cryptographic content hash.
- Flow/context (company registration, subscription purchase, renewal, or revised policy).
- Subscription plan/order ID when relevant.
- A record/event ID and integrity/audit metadata.
- Request metadata such as IP address only where necessary, proportionate, disclosed, and approved under the privacy/retention policy.

Never trust a client-submitted timestamp, company ID, role, policy text, or policy version without server-side validation. Do not store passwords, authentication tokens, or full payment credentials in this register. Prevent ordinary users from editing or deleting acceptance records. Enforce tenant isolation and restrict exports to authorized roles.

## Printable PDF evidence

Provide an authorized **Download / Print Acceptance Record (PDF)** action from the company profile and subscription history. The PDF should contain:
1. Product/operator legal entity and generated-on timestamp.
2. Company legal name and internal tenant/account reference.
3. Accepting person's name/ID and company role as recorded at acceptance.
4. Each policy title, version, action type, effective date, acceptance timestamp with timezone stated, and content hash/revision reference.
5. Subscription plan, order/transaction reference and purchase timestamp when applicable.
6. Record ID, page numbers, and a verification reference or QR code pointing to an authenticated verification page (never expose private data publicly).
7. A note explaining that this is a system-generated audit record and how its authenticity can be verified.

PDF generation must use data read from the server, not form fields supplied by the requesting client. Log PDF exports (who, which company/record, and when). Keep export access permission-controlled; do not email legal records to unverified addresses by default. The PDF is supporting evidence, not a guarantee of legal admissibility.

## Security and data governance

- Use append-only or equivalently tamper-evident records with access restricted by role.
- Keep policy versions immutable; updates create new versions.
- Record admin changes to policy publication and permissions in the audit log.
- Apply documented retention, deletion, backup and legal-hold procedures consistent with Malaysian legal advice and privacy obligations.
- If company administrators can accept for the company, record their authority/role and have counsel approve the representation wording.
- Do not make unsupported claims that a record is legally conclusive or that the platform is certified.

## Required automated tests

- Registration and subscription cannot complete while any applicable required acceptance is missing.
- A request with a forged, obsolete, unpublished or mismatched policy version is rejected.
- Server time is used; client timestamps cannot replace it.
- Historical acceptance rows cannot be edited/deleted by ordinary users.
- Cross-tenant read/export attempts are denied.
- Only authorized roles can generate/download PDFs.
- PDF content matches the stored record and policy version; repeated export does not change the underlying evidence.
- Export activity is audited.
- Updated policy acceptance creates a new record and preserves prior history.
- Company representative identity and role are recorded correctly.
- Unit/integration tests, lint and builds pass before release.

## Release gates

1. Integrate with the actual company onboarding, authentication, tenant model, subscription checkout and database schema.
2. Implement migrations, server validation, authorization, immutable records, PDF generation and audit events.
3. Add customer-visible legal pages and versioned publication workflow.
4. Test on a feature branch; review tenant isolation and export permissions.
5. Complete all policy placeholders and obtain Malaysian legal/privacy review.
6. Open a PR for review. Do not merge or deploy production until approved.

This document is a specification only. It does not claim the acceptance checklist, database storage, PDF export, or API enforcement is already present.
