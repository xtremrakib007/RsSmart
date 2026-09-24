import {
  Controller, Get, HttpCode, HttpStatus, Logger, ServiceUnavailableException, VERSION_NEUTRAL,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';
import Redis from 'ioredis';

@Public()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly redis: Redis;

  constructor(private readonly prisma: PrismaService) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
      retryStrategy: () => null,
      maxRetriesPerRequest: 1,
    });
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async check() {
    return this.runChecks(true);
  }

  @Get('live')
  @HttpCode(HttpStatus.OK)
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async ready() {
    return this.runChecks(true);
  }

  private async runChecks(requireRedis: boolean) {
    const [db, redis] = await Promise.all([this.checkDb(), this.checkRedis()]);
    const ok = db.ok && (!requireRedis || redis.ok);
    const body = { status: ok ? 'ok' : 'degraded', timestamp: new Date().toISOString(), checks: { database: db, redis } };
    if (!ok) throw new ServiceUnavailableException(body);
    return body;
  }

  private async checkDb(): Promise<{ ok: boolean; error?: string }> {
    try { await this.prisma.$queryRaw`SELECT 1`; return { ok: true }; }
    catch (err) { this.logger.error('Database health check failed', err as Error); return { ok: false, error: 'unreachable' }; }
  }

  private async checkRedis(): Promise<{ ok: boolean; error?: string }> {
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      return { ok: (await this.redis.ping()) === 'PONG' };
    } catch (err) { this.logger.error('Redis health check failed', err as Error); return { ok: false, error: 'unreachable' }; }
  }
}
