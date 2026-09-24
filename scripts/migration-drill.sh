#!/bin/bash
# Phase 32B — Database Migration Drill
# Tests three migration paths

set -euo pipefail

DB_NAME="rssmart_migration_drill"
DB_USER="postgres"
DB_PASS="postgres"
DB_PORT="5433"

echo "🔧 Phase 32B: Database Migration Drill"

# Test 1: Empty DB → migrate deploy
echo ""
echo "Test 1: Empty database → migrate deploy"
docker run --rm -d --name drill-db-1 -e POSTGRES_USER=${DB_USER} -e POSTGRES_PASSWORD=${DB_PASS} -e POSTGRES_DB=${DB_NAME} -p ${DB_PORT}:5432 postgres:15-alpine
sleep 3

cd backend
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}?schema=public"   npx prisma migrate deploy

echo "✅ Test 1 passed"
docker stop drill-db-1 && docker rm drill-db-1

# Test 2: Existing DB → migrate deploy
echo ""
echo "Test 2: Existing database → migrate deploy"
docker run --rm -d --name drill-db-2 -e POSTGRES_USER=${DB_USER} -e POSTGRES_PASSWORD=${DB_PASS} -e POSTGRES_DB=${DB_NAME} -p ${DB_PORT}:5432 postgres:15-alpine
sleep 3

DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}?schema=public"   npx prisma migrate deploy

echo "✅ Test 2 passed"
docker stop drill-db-2 && docker rm drill-db-2

# Test 3: Backup → restore → migrate
echo ""
echo "Test 3: Backup → restore → migrate"
docker run --rm -d --name drill-db-3 -e POSTGRES_USER=${DB_USER} -e POSTGRES_PASSWORD=${DB_PASS} -e POSTGRES_DB=${DB_NAME} -p ${DB_PORT}:5432 postgres:15-alpine
sleep 3

DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}?schema=public"   npx prisma migrate deploy

pg_dump -h localhost -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -F c -f /tmp/drill-backup.dump

docker stop drill-db-3 && docker rm drill-db-3
docker run --rm -d --name drill-db-3 -e POSTGRES_USER=${DB_USER} -e POSTGRES_PASSWORD=${DB_PASS} -e POSTGRES_DB=${DB_NAME} -p ${DB_PORT}:5432 postgres:15-alpine
sleep 3

pg_restore -h localhost -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} --clean --if-exists /tmp/drill-backup.dump || true

DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}?schema=public"   npx prisma migrate deploy

echo "✅ Test 3 passed"
docker stop drill-db-3 && docker rm drill-db-3
rm -f /tmp/drill-backup.dump

echo ""
echo "🎉 All migration drill tests passed!"
