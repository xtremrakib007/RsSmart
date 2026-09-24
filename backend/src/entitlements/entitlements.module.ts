import { Module } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';
import { EntitlementsController } from './entitlements.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

// Phase 17: added EntitlementsController (the "plan limits" endpoint) here
// rather than in SubscriptionsModule, specifically to avoid a circular
// module dependency — this module already imports SubscriptionsModule for
// SubscriptionsService, so SubscriptionsModule importing this one back
// would be circular. Both controllers share the 'subscriptions' route
// prefix, so this is invisible to API callers. Actually blocking an
// over-limit action is still Phase 23, not this phase.
@Module({
  imports: [SubscriptionsModule],
  controllers: [EntitlementsController],
  providers: [EntitlementsService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
