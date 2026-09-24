import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

/**
 * Phase 34 — Monitoring & Alerts.
 *
 * Exposes /metrics for Prometheus scraping.
 * Default metrics (memory, CPU, event loop lag, GC, etc.) are collected
 * automatically by prom-client.
 *
 * Custom application metrics can be added here later (e.g. API latency
 * histograms, business-event counters) but the base endpoint is the
 * minimum required for the infrastructure/prometheus/prometheus.yml
 * scrape config to work.
 */
@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
    }),
  ],
})
export class MetricsModule {}
