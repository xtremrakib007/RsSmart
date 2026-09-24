## What
<!-- Brief description of the change -->

## Why
<!-- Business/technical reason -->

## How to test
<!-- Steps or commands to verify -->

## Checklist
- [ ] `npm run lint` passes
- [ ] `npm run test` passes
- [ ] `npm run test:e2e` passes (if applicable)
- [ ] `npm run build` succeeds
- [ ] Prisma schema changes include a migration
- [ ] No secrets committed
- [ ] Tenant isolation considered (every query scoped to `tenantId`)
