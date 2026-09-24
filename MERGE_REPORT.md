# Merge Report

Merged from 8 uploaded zips, which turned out to be snapshots of one monorepo
(`backend/`, `sales-android/`, `pos-android/`, `pos-windows/`, `erp-windows/`,
`infrastructure/`, `docs/`, `shared-types/`) at different points across
Phases 0–8, plus three standalone "fullest build" exports.

## What came from where

| Folder | Source zip | Why |
|---|---|---|
| `backend/` (core) | `phase3-sales-android.zip` | Latest/fullest cumulative backend snapshot (phase0→1→2→3 all rolled forward into this one) |
| `backend/instrumentation.ts`, `logger.ts`, `cache/redis.ts`, `db/router.ts`, `i18n/index.ts`, `metrics/index.ts`, `notifications/{email,fcm,sms}.ts` | `erp-phase7-8.zip` | New files not present in any phase0-3 zip — layered on top of the phase3 backend |
| `sales-android/` | `phase3-sales-android.zip` | Only zip containing a full build of this app |
| `pos-android/` | `pos-android.zip` | Standalone export was the only full build; phase0-2 zips only had a placeholder folder for it |
| `pos-windows/` | `pos-windows.zip` | Same reasoning |
| `erp-windows/` | `erp-windows.zip` | Same reasoning |
| `docs/`, `shared-types/`, `infrastructure/docker`, `infrastructure/nginx` | `phase3-sales-android.zip` | Carried through unchanged from the base snapshot |
| `infrastructure/docker-compose.prod.yml`, `k8s/`, `k6/`, `prometheus/`, `nginx-prod/` | `erp-phase7-8.zip` | Phase 7-8 production/ops additions, kept alongside the existing dev-time `infrastructure/docker` and `infrastructure/nginx` rather than overwriting them — check before removing the dev configs |
| `.github/workflows/` | `erp-phase7-8.zip` | CI/CD pipelines |

## Not placed — needs your decision

`_unplaced/erp-android-polish/` — `FirebaseService.kt`, `SentrySetup.kt`,
`Theme.kt` from `erp-phase7-8.zip`'s `android/` folder. Classes are named
`ERPFirebaseService`, `ERPApplication`, `ERPTheme` — that naming doesn't match
either Android app in this repo (`pos-android` is package `com.retail.pos`,
`sales-android` is `com.company.salesapp`). Likely meant for a future Android
ERP client that wasn't part of any of these 8 uploads, or these are stale
scaffolding. Left out of both app trees rather than guessing — move into
whichever app they belong to (with package names adjusted) once you confirm.

## Inconsistency to check

`pos-android/README.md` describes a `:shared` Gradle module "reusable across
Sales App and POS App." That module exists inside `pos-android/shared/` (own
copy), but `sales-android/`'s build does not depend on it or any shared
module — it has its own independent data layer. Either the shared-module plan
was never actually wired into `sales-android`, or it's aspirational text left
over from planning. Not fixed here since it's a design decision, not a merge
mechanic.

## Deploy as 5 separate artifacts from this one repo

1. `backend/` — one API/WS/worker service → `infrastructure/docker-compose.prod.yml` or `infrastructure/k8s/`
2. `sales-android/` → APK
3. `pos-android/` → APK
4. `pos-windows/` → Tauri installer
5. `erp-windows/` → Tauri installer
