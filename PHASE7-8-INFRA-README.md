# ERP Phase 7 & 8 - Infrastructure & Polish

## Quick Start

### Production Deployment
```bash
cp .env.example .env
# Edit .env with your secrets
docker compose -f docker-compose.prod.yml up -d
```

### CI/CD
1. Add secrets to GitHub repository settings
2. Push to `develop` → auto-deploys to staging
3. Push tag `v*` → auto-deploys to production (requires approval)

### Load Testing
```bash
k6 run --env BASE_URL=https://api.yourdomain.com k6/load-test.js
```

### Backup
```bash
chmod +x scripts/backup.sh
# Add to crontab: 0 2 * * * /path/to/scripts/backup.sh
```

## Directory Structure
```
.
├── docker-compose.prod.yml
├── nginx/
│   └── nginx.conf
├── .github/
│   └── workflows/
│       ├── ci-cd.yml
│       ├── android-release.yml
│       └── security.yml
├── k8s/
│   ├── base/
│   │   ├── namespace.yaml
│   │   ├── api-deployment.yaml
│   │   ├── api-service.yaml
│   │   ├── api-hpa.yaml
│   │   └── ingress.yaml
│   └── overlays/
│       └── production/
│           ├── kustomization.yaml
│           └── patch-replicas.yaml
├── prometheus/
│   └── prometheus.yml
├── scripts/
│   └── backup.sh
├── k6/
│   └── load-test.js
├── backend/
│   ├── cache/redis.ts
│   ├── db/router.ts
│   ├── metrics/index.ts
│   ├── notifications/
│   │   ├── fcm.ts
│   │   ├── email.ts
│   │   └── sms.ts
│   ├── logger.ts
│   ├── instrumentation.ts
│   └── i18n/index.ts
├── android/
│   ├── SentrySetup.kt
│   ├── FirebaseService.kt
│   └── Theme.kt
└── windows/
    └── tauri.conf.json
```
