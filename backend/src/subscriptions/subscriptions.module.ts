import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { AuditModule } from '../audit/audit.module';

// Phase 17: added the read-only HTTP surface (current subscription /
// current plan / available plans) on top of the Phase 15 lifecycle
// service. The "plan limits" endpoint lives on EntitlementsController in
// EntitlementsModule instead, alongside the same 'subscriptions' route
// prefix — see that controller's file comment for why it's split there
// rather than imported into this module (would create a circular
// module dependency with EntitlementsModule, which already imports this
// module for SubscriptionsService).
@Module({
  imports: [AuditModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
