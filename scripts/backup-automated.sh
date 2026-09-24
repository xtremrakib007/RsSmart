#!/bin/bash
# Phase 33A — Automated PostgreSQL Backup
# Run via cron: 0 2 * * * /path/to/backup-automated.sh

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/rssmart}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DB_NAME="${DB_NAME:-central_db}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
S3_BUCKET="${S3_BUCKET:-}"  # Optional: upload to S3
WEBHOOK_URL="${WEBHOOK_URL:-}"  # Optional: notify on failure

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/rssmart_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting backup..."

# Perform backup
if ! pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-privileges | gzip > "${BACKUP_FILE}"; then
  echo "[$(date)] ❌ Backup failed!"
  if [ -n "${WEBHOOK_URL}" ]; then
    curl -X POST "${WEBHOOK_URL}" -H "Content-Type: application/json"       -d '{"text":"🚨 RsSmart backup failed!"}' || true
  fi
  exit 1
fi

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date)] ✅ Backup complete: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Upload to S3 if configured
if [ -n "${S3_BUCKET}" ]; then
  if command -v aws >/dev/null 2>&1; then
    aws s3 cp "${BACKUP_FILE}" "s3://${S3_BUCKET}/backups/"
    echo "[$(date)] ☁️  Uploaded to S3"
  else
    echo "[$(date)] ⚠️  AWS CLI not found, skipping S3 upload"
  fi
fi

# Clean old backups
find "${BACKUP_DIR}" -name "rssmart_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "[$(date)] 🧹 Cleaned backups older than ${RETENTION_DAYS} days"

# Verify backup integrity
if ! gunzip -t "${BACKUP_FILE}"; then
  echo "[$(date)] ❌ Backup file is corrupted!"
  exit 1
fi

echo "[$(date)] ✅ Backup verified and retained"
