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

  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'production') {
      const models = ['auditLogs', 'syncEvents', 'posSessions', 'payments', 'orderItems', 
        'orders', 'customerVisits', 'customers', 'stockMovements', 'inventory', 
        'products', 'categories', 'units', 'userRoles', 'roles', 'users', 'tenants'];
      for (const model of models) {
        await (this as any)[model].deleteMany().catch(() => null);
      }
    }
  }
}
