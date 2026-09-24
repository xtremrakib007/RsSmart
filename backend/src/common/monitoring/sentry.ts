import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

/**
 * Phase 34A — Error Monitoring (Sentry)
 *
 * Initialize Sentry for backend error tracking.
 * Call this BEFORE creating the NestJS app in main.ts.
 *
 * Required env:
 *   SENTRY_DSN=https://...@sentry.io/...
 *   NODE_ENV=production
 *   GIT_SHA=abc123  (for release tracking)
 */
export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.warn('[Sentry] SENTRY_DSN not set — error monitoring disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.GIT_SHA || 'unknown',
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,
    beforeSend(event) {
      // Scrub PII before sending
      if (event.request?.headers?.authorization) {
        event.request.headers.authorization = '[REDACTED]';
      }
      return event;
    },
  });

  console.log('[Sentry] Initialized for environment:', process.env.NODE_ENV);
}
