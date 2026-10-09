# RsSmart Data Retention and Deletion Policy — DRAFT

Owner: [PRIVACY/SECURITY OWNER]
Review interval: at least annually and after material changes.

## Principles
- Keep personal data only as long as necessary for the documented business, security, contractual, and legal purposes.
- Apply the same retention rules to primary systems, exports, logs, analytics, and backups where technically and legally appropriate.
- Do not delete records that must be retained for legal, tax, dispute, or security reasons; document the basis and restrict access.
- Support tenant-scoped export and deletion workflows with identity and authorization checks.

## Required retention schedule
The service owner must complete and approve a schedule before launch. At minimum define retention for:
- Account/profile data after account closure.
- Tenant business records and invoices.
- Customer/contact records imported by tenants.
- Authentication/security/audit logs.
- Support tickets and communications.
- WhatsApp message metadata and media.
- Backups, snapshots, and disaster-recovery copies.
- Failed jobs, queue payloads, and webhook event logs.
- Subscription, payment-status, and accounting records.

For every category record: purpose, owner, retention period, legal basis, deletion/anonymization method, backup expiry, and exception/hold procedure. Do not invent a universal retention period; obtain accounting and legal advice for the applicable record types.

## Requests
Verify the requester's identity and authority, determine whether the data belongs to a tenant or RsSmart, assess legal holds, document the decision, and complete the action within applicable statutory deadlines. Tenant administrators must not be allowed to delete another tenant's data.

## Disposal and verification
Use supported deletion or anonymization procedures, restrict backups, expire them on schedule, and log the outcome without copying the data being deleted into the audit record. Test restore and deletion behavior in a non-production environment.

This policy is not operational until a retention schedule, deletion workflow, backup lifecycle, and responsible owner are configured and tested.