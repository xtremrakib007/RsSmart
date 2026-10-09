# RsSmart Information Security Policy

**Internal baseline draft; not proof controls are implemented.** Owner: [SECURITY OWNER].

## Identity and access
Use unique accounts, least privilege and server-side role authorization. Require MFA for privileged cloud, source-control and production access where available. Review access regularly and revoke promptly. Never expose secrets in frontend code, logs, tickets or repositories.

## Secrets and encryption
Store production secrets in managed secret storage or protected deployment variables and rotate exposed credentials. Use TLS in transit and provider-supported encryption at rest for databases and backups. If passwords are used, store only modern password hashes. Never store raw card security codes or full card data; use approved hosted/tokenized checkout.

## Application security
Validate inputs server-side, use parameterized database access, safe output encoding, suitable CSRF/CORS controls and secure headers. Authenticate and authorize every protected route and tenant-scoped resource. Apply rate limits and safe errors. Verify webhook signatures and protect against replay and duplicate processing. Patch supported dependencies and critical vulnerabilities promptly.

## Audit and monitoring
Log authentication outcomes, permission changes, privileged access, exports, tenant changes, payment status and admin actions. Exclude passwords, tokens, card data and unnecessary personal data. Restrict log access, protect integrity, define retention and test alerts.

## Backups and recovery
Automate encrypted backups, restrict access, define retention and recovery objectives, and regularly test restoration. A successful backup job alone does not prove recovery works.

## Incident response and release
Maintain an incident runbook for triage, containment, evidence, credential rotation, recovery, legal-notification assessment and post-incident review. Use code review, protected branches, CI, dependency and secret scanning, separate environments and reviewed migrations. Resolve critical findings or document accountable risk acceptance before release.

## Verification
Test tenant isolation, privilege escalation, sessions, input validation, webhook forgery/replay, rate limits, log redaction, restore procedures and alert delivery. Record findings and remediation. Do not describe controls as operational until verified.
