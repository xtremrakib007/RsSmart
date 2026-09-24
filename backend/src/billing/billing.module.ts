import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';

// No AuditModule import — this module is read-only (see BillingService's
// file comment), so there is nothing here that mutates state or needs an
// audit trail. PrismaModule is @Global() (see common/prisma/prisma.module.ts)
// so PrismaService is available without an explicit import here, matching
// SubscriptionsModule's pattern.
@Module({
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
