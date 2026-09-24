#!/bin/bash
# Phase 32A — Staging Environment Deployment
# Usage: ./deploy-staging.sh [tag]

set -euo pipefail

TAG="${1:-latest}"
ENV="${ENV:-staging}"
COMPOSE_FILE="infrastructure/docker-compose.prod.yml"

echo "🚀 Deploying RsSmart to ${ENV}..."

# Verify prerequisites
command -v docker >/dev/null 2>&1 || { echo "❌ Docker required"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ docker-compose required"; exit 1; }

# Pull latest images
echo "📦 Pulling images..."
docker-compose -f ${COMPOSE_FILE} pull

# Run migrations
echo "🗄️  Running database migrations..."
docker-compose -f ${COMPOSE_FILE} run --rm api npx prisma migrate deploy

# Seed if needed (only in staging)
if [ "${ENV}" = "staging" ]; then
  echo "🌱 Seeding staging data..."
  docker-compose -f ${COMPOSE_FILE} run --rm api npx prisma db seed || true
fi

# Restart services
echo "🔄 Restarting services..."
docker-compose -f ${COMPOSE_FILE} up -d

# Health check
echo "🏥 Health check..."
sleep 5
HEALTH=$(docker-compose -f ${COMPOSE_FILE} ps -q api | xargs docker inspect --format='{{.State.Health.Status}}')
if [ "${HEALTH}" != "healthy" ]; then
  echo "⚠️  API health check failed. Rolling back..."
  docker-compose -f ${COMPOSE_FILE} down
  exit 1
fi

echo "✅ Staging deployment complete!"
echo "   API: https://staging.api.rssmart.com"
echo "   Health: https://staging.api.rssmart.com/health"
