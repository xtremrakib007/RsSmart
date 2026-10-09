# RsSmart Data Protection Policy

**Internal operational draft.** Owner: [PRIVACY/DATA OWNER]. Review annually and after material changes.

## Governance and minimization
Maintain a data inventory showing categories, purposes, legal roles, systems, recipients, locations, access groups and retention periods. Collect only necessary data. Avoid production personal data in development and test environments.

## Tenant isolation
Derive tenant identity from authenticated server-side context; do not trust a client-supplied tenant ID alone. Scope reads, writes, exports, jobs, files, search and analytics to the authorized tenant. Test cross-tenant access attempts. Privileged support access must be authorized, least-privilege and audited.

## Access and requests
Use least privilege, role-based permissions, strong authentication for privileged accounts, timely revocation and periodic access reviews. Verify identity for data requests and coordinate tenant-owned data requests with the relevant tenant.

## Retention and deletion
Define approved retention periods by data category. Implement account closure, export, deletion, legal holds and backup expiry. Document lawful exceptions. Do not claim data is deleted until replicas and backups follow the documented lifecycle.

## Vendors and transfers
Maintain a subprocessor register with services, data categories, locations, contracts and safeguards. Assess cross-border transfers under current law.

## Incidents and review
Triage incidents, contain exposure, preserve evidence, assess affected people and legal duties, notify within applicable timelines, and document remediation. Train personnel with data access and retain evidence of reviews.

Assess and document whether actual processing triggers a DPO appointment or other mandatory duties under current Malaysian law. Evidence should include data inventory, access reviews, isolation tests, retention schedule, deletion tests, vendor register and incident runbook.
