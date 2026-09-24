# Phase 29 — WhatsApp Media & Templates (2026-08-30)

## Goal
Complete only the WhatsApp features required for launch.

## What changed

### Schema
- `WhatsAppTemplate` model — stores pre-approved template definitions.
  Fields: `name`, `language`, `category`, `status` (PENDING/SUBMITTED/APPROVED/REJECTED/PAUSED/DELETED),
  `body` (with `{{1}}` placeholders), `headerType`, `headerText`, `headerMediaUrl`,
  `footer`, `buttons`, `providerTemplateId`, `providerStatus`, `providerRejectionReason`.
- `WhatsAppCampaign.templateId` — campaigns can now reference a template
  instead of raw `messageTemplate` text.
- `WhatsAppCampaignRecipient.templateParams` — per-recipient parameter
  values for template substitution.

### Provider interface
- `sendTemplate(account, to, { name, language, params })` — sends a
  Meta Cloud API template message.
- `sendMedia(account, to, { type, url, caption, filename })` — sends
  image/document/video/audio messages.
- `uploadMedia(account, file, mimeType)` — uploads media to Meta's CDN
  and returns a `mediaId` (Meta Cloud only).

### Meta Cloud provider
- `sendTemplate()` builds the `template` message payload with `components`
  array for body parameter substitution.
- `sendMedia()` maps `type` to the correct Meta message type (`image`,
  `document`, `video`, `audio`).
- `uploadMedia()` uses `FormData` to upload binary media to Meta's
  `/media` endpoint.

### Mock provider
- Stubs return `mock-template-*` and `mock-media-*` provider message IDs.

### Service
- `createTemplate()` validates Meta naming rules (lowercase alphanumeric
  + underscore only) when provider is `META_CLOUD`.
- `sendTemplateMessage()` requires template status `APPROVED`.
- `sendMediaMessage()` supports `image`, `document`, `video`, `audio`.
- `listTemplates`, `getTemplate`, `updateTemplate`, `deleteTemplate`
  (soft delete to `DELETED` status).

### Campaign processor
- `sendRecipient()` now checks `campaign.template`. If present, sends a
  template message with recipient-specific `templateParams`. Otherwise
  falls back to legacy text replacement.

### Controller
- `GET /whatsapp/templates` — list
- `POST /whatsapp/templates` — create
- `GET /whatsapp/templates/:id` — get
- `PUT /whatsapp/templates/:id` — update
- `POST /whatsapp/templates/:id/delete` — soft delete
- `POST /whatsapp/accounts/:id/templates/send` — send template message
- `POST /whatsapp/accounts/:id/media/send` — send media message

## Tests

| Test file | Coverage |
|-----------|----------|
| `src/whatsapp/whatsapp.service.spec.ts` | Template name validation, template send (approved/rejected), media send |

## Security
- All template endpoints require JWT auth and scope to `tenantId`.
- Template names for Meta are normalized server-side — client cannot
  bypass Meta's naming rules.

## Remaining risks / deferred
- **No Meta template submission API**: Templates are created in the DB
  but not automatically submitted to Meta for approval. A manual or
  scheduled submission flow would need the Business Account ID and
  additional Graph API calls.
- **No media upload endpoint**: `uploadMedia()` exists in the provider
  but is not exposed via a controller endpoint yet. Add when the mobile
  app needs to upload images directly.
- **No template preview rendering**: The UI would benefit from a
  server-side preview that substitutes placeholders with sample data.
- **Sandbox limitation**: `prisma generate` / `migrate deploy` / `npm test`
  / `npm run build` need to run for real in a live environment.

## Done when
- `npm test` shows template + media tests passing
- `npm run build` compiles
- `prisma validate` is green
- Meta test-number template send returns a valid message ID
