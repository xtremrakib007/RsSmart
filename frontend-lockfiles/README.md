# Frontend Lockfiles

## Status
- `erp-windows/package-lock.json` — committed
- `pos-windows/package-lock.json` — committed

CI installs both frontends with `npm ci`, which requires the lockfile to be
in sync with `package.json`. After changing dependencies, run `npm install`
in the project directory and commit the updated `package-lock.json`.
