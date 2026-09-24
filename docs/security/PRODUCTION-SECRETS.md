# Phase 35B — Production Secrets Management

## Principle
No production secret is committed to Git.

## Required Secrets

| Secret | Used By | Rotation Frequency |
|--------|---------|-------------------|
| `DATABASE_URL` | Backend | On breach or quarterly |
| `JWT_SECRET` | Auth service | On breach or quarterly |
| `JWT_REFRESH_SECRET` | Auth service | On breach or quarterly |
| `REDIS_PASSWORD` | Cache, BullMQ | On breach |
| `WHATSAPP_CREDENTIAL_ENCRYPTION_KEY` | WhatsApp service | On breach |
| `META_APP_SECRET` | Webhook verification | On breach |
| `META_WHATSAPP_VERIFY_TOKEN` | Webhook verification | On breach |
| `BILLPLZ_API_KEY` | Payment service | On breach |
| `BILLPLZ_X_SIGNATURE_KEY` | Payment webhooks | On breach |
| `SENDGRID_API_KEY` | Email service | On breach |
| `SENTRY_DSN` | Error monitoring | Rarely |

## Deployment Methods

### Option 1: Environment Variables (Staging)
Use `.env` files that are NOT committed:
```bash
# .env.production — NOT in Git
cp .env.example .env.production
# Fill in real values, store in 1Password/Vault
```

### Option 2: Kubernetes Secrets (Production)
```bash
kubectl create secret generic rssmart-secrets \
  --from-literal=DATABASE_URL='postgresql://...' \
  --from-literal=JWT_SECRET='...' \
  --from-literal=BILLPLZ_API_KEY='...'
```

### Option 3: Cloud Secret Manager (Recommended)
- AWS Secrets Manager
- Google Secret Manager
- Azure Key Vault

Inject at runtime:
```yaml
env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: rssmart-secrets
        key: DATABASE_URL
```

## Verification
Run before every deployment:
```bash
npm run validate:env
npm run verify:production
```

## Incident Response
If a secret is leaked:
1. Rotate immediately
2. Revoke old tokens/credentials
3. Audit logs for abuse
4. Notify affected tenants if applicable
