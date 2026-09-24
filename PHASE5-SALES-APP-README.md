# Phase 5 — Sales App Field Operations

Added to the canonical project:
- Central field-sales dashboard endpoint
- Sales target model and API
- Route-plan model and API
- Attendance check-in/check-out with optional GPS coordinates
- Attendance history API
- Android SalesApi + DTOs + repository
- Dashboard now refreshes KPIs from the central API when online
- Prisma migration for field-sales tables
- Fixed missing Retrofit `@Path` import in ProductApi

## Production verification still required
- Run `npm ci` and `npx prisma generate` in `backend/`
- Run Prisma migration against a staging PostgreSQL database
- Run `npm run build` and tests
- Configure Android Firebase and API base URL
- Build the Android app with Gradle
- Add dedicated route/target/attendance screens if required by the final UX
- Perform offline sync and conflict E2E tests
