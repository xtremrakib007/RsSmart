import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'info', 'warn', 'error'] 
        : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Empties every table for e2e tests. Runs only with NODE_ENV=test (never
   * on a misconfigured server) and keeps the migration history and the
   * subscription plans the tests sign up on.
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') return;
    const rows = await this.$queryRawUnsafe<{ tablename: string }[]>(
      `SELECT tablename FROM pg_tables WHERE schemaname = current_schema()
         AND tablename NOT IN ('_prisma_migrations', 'subscription_plans')`,
    );
    if (!rows.length) return;
    const list = rows.map((r) => `"${r.tablename.replace(/"/g, '""')}"`).join(', ');
    await this.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
  }
}
