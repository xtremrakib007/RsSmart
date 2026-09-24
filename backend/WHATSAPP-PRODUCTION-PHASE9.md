# Phase 9 — WhatsApp production provider hardening

Implemented in this phase:

- Per-account Meta Cloud API access tokens stored encrypted at rest with AES-256-GCM.
- Account listing never returns the encrypted token.
- Meta webhook POST requests require `X-Hub-Signature-256` verification using `META_APP_SECRET`.
- Nest is configured with `rawBody: true` so the signature is checked against the received bytes.
- Meta delivery/read status webhooks update the matching message timestamps.
- Meta Cloud provider uses the per-account encrypted token, falling back to the legacy global token for migration compatibility.
- Added database migration for encrypted credentials.

Production requirements:

1. Set `WHATSAPP_CREDENTIAL_ENCRYPTION_KEY` to a high-entropy secret and store it in a secrets manager.
2. Set `META_APP_SECRET` and `META_WHATSAPP_VERIFY_TOKEN`.
3. Use HTTPS for the webhook endpoint.
4. Rotate/revoke tokens when staff access changes.
5. Add media download/storage and template/interactive message support before advertising those features as available.
6. Run integration tests against a Meta test number before production rollout.
