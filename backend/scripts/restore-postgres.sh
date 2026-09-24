#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${1:?Usage: restore-postgres.sh <backup.dump>}"
pg_restore "$DATABASE_URL" --clean --if-exists --no-owner --no-acl "$1"
echo "Restore completed from $1"
