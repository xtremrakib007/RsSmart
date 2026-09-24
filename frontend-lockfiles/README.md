# Frontend Lockfiles

## Status
- `erp-windows/package-lock.json` — NOT committed yet
- `pos-windows/package-lock.json` — NOT committed yet

## To generate
```bash
cd erp-windows && npm install
cd ../pos-windows && npm install
# Commit the resulting package-lock.json files
git add erp-windows/package-lock.json pos-windows/package-lock.json
```

## Why this matters
`npm ci` (used in CI) requires an exact lockfile. Without it, CI falls back
to `npm install` which may resolve slightly different dependency versions.
