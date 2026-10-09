# Legal Pages and Acceptance Tracking — Implementation Specification

**Status: specification only. UI/backend integration is not implemented by this document.** Build this against the existing application after locating its frontend and auth/account models; do not invent schema names or bypass existing guards.

## User-facing pages
- Add a persistent **Legal** section in app Settings/footer with links to Terms, Privacy, Acceptable Use, Refund/Cancellation, Data Protection and Payment Gateway policy.
- Show Subscription Agreement before plan purchase/renewal.
- Provide the Information Security Policy as a customer-safe summary; keep internal runbooks, detection rules and sensitive architecture details staff-only.
- Provide the DPA for eligible business customers and a workflow to request/execute a copy.
- Ensure all documents are mobile accessible, keyboard accessible, versioned, and readable before account creation where appropriate.
- Use approved, completed policy text only; block publishing when required placeholders remain.

## Acceptance flow
- At registration, present unchecked acceptance controls for the applicable Terms and Conditions and Privacy Policy acknowledgement; link to the full documents. Do not use pre-checked boxes or bundle optional marketing consent with contractual acceptance.
- Before purchase, show plan, price, billing interval, renewal/cancellation terms and subscription agreement. Record affirmative acceptance.
- Re-prompt when a materially revised agreement requires renewed acceptance. Do not silently rewrite historic acceptance records.
- Define which policies require acceptance versus acknowledgement with Malaysian counsel; a policy being readable does not automatically mean users must accept every policy.

## Acceptance record
Persist server-side, tied to the authenticated account/user and (where relevant) tenant. Record:
- policy key and immutable version identifier;
- action (accepted/acknowledged);
- server-generated UTC timestamp;
- user/account and tenant identifiers;
- policy content hash or immutable revision reference;
- source flow (registration, subscription checkout, updated terms);
- optional request metadata only when justified and disclosed.
Never accept a client-provided timestamp as authoritative. Do not log credentials, payment details or unnecessary personal data. Enforce uniqueness/idempotency suitable for retries.

## API and authorization
- Add a server endpoint to list current published policy versions and acceptance requirements.
- Add an authenticated endpoint to record an acceptance, validating the current published version on the server.
- Add a read endpoint for a user's/tenant's acceptance history restricted to that principal and authorized admins.
- Protect policy publication/version changes with admin permissions and audit logging.
- If the product permits existing users to sign in without accepting newly required terms, gate only the relevant features/flows according to the approved migration plan.
- Never treat a frontend-only checkbox as enforcement.

## Privacy, retention and audit
- Document the lawful purpose and retention period for acceptance records.
- Keep records tamper-resistant and access-restricted; avoid logging full policy text repeatedly if immutable version/hash suffices.
- Provide an auditable process for policy version changes, publication, rollback and legal review.
- Ensure deletion/retention behavior is consistent with applicable legal obligations.

## Tests required before release
- User cannot submit required acceptance unchecked.
- API rejects obsolete, unpublished or forged policy versions.
- Duplicate requests are idempotent.
- User A cannot read or alter User B's records; tenant A cannot access tenant B's records.
- Policy revision prompts acceptance according to configured rules.
- Acceptance records include server timestamp and immutable version/hash.
- Admin-only publication changes are denied to ordinary users and audited.
- Subscription purchase does not proceed without required agreement acceptance.
- Accessibility and mobile rendering verified.
- Run existing unit/integration tests, lint and build; report results from actual commands.

## Delivery gates
1. Identify the real frontend, registration and checkout routes and current data model.
2. Implement in a feature branch without merging/deploying production.
3. Run tests and inspect the diff for secrets and tenant authorization.
4. Obtain legal approval of policy content and acceptance requirements.
5. Open a PR with test evidence; merge/deploy only after review.

This specification does not claim that UI pages, database migrations, endpoints or acceptance enforcement already exist.
