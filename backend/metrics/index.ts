import promClient from 'prom-client';

promClient.collectDefaultMetrics();

export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const activeSessions = new promClient.Gauge({
  name: 'active_pos_sessions',
  help: 'Number of active POS sessions',
});

export const syncQueueSize = new promClient.Gauge({
  name: 'sync_queue_size',
  help: 'Number of pending sync operations',
});

export function metricsMiddleware(req, res, next) {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route?.path || 'unknown', status_code: res.statusCode });
  });
  next();
}
