#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/central-db-$STAMP.dump"
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl --file="$OUT"
find "$BACKUP_DIR" -type f -name 'central-db-*.dump' -mtime +"$RETENTION_DAYS" -delete
echo "Created $OUT"
