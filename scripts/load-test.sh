#!/bin/bash
# Phase 36C — Load Test
# Usage: ./load-test.sh [duration] [concurrency]

set -euo pipefail

DURATION="${1:-60s}"
CONCURRENCY="${2:-50}"
API_URL="${API_URL:-http://localhost:3000}"

echo "🔥 Phase 36C: Load Test"
echo "   Target: ${API_URL}"
echo "   Duration: ${DURATION}"
echo "   Concurrency: ${CONCURRENCY}"

# Check for k6 or hey
if command -v k6 >/dev/null 2>&1; then
  echo "📊 Using k6 for load testing..."

  cat > /tmp/load-test.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(`${__ENV.API_URL}/health`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
EOF
  API_URL="${API_URL}" k6 run /tmp/load-test.js

elif command -v hey >/dev/null 2>&1; then
  echo "📊 Using hey for load testing..."
  hey -z "${DURATION}" -c "${CONCURRENCY}" "${API_URL}/health"
else
  echo "⚠️  Neither k6 nor hey installed. Install one of:"
  echo "   brew install k6    # or apt, etc."
  echo "   brew install hey"
  exit 1
fi

echo "✅ Load test complete!"
