import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { CurrentUser } from '../common/decorators/user.decorator';

// Read-only per the Phase 17 roadmap entry — lifecycle mutations
// (activate/cancel/suspend/expire) already exist on SubscriptionsService
// (Phase 15) but are deliberately not exposed here; wiring them up safely
// (who's allowed to cancel, how a checkout flow reaches activate()) is
// Phase 20/21 territory, not "expose plans/subscription safely".
//
// No @RequirePermissions on any of these — same as OutletsController's
// list()/get(): any authenticated user of the tenant can view their own
// company's subscription, matching "a company can only see its own
// subscription" (enforced structurally below: every handler reads
// tenantId off the verified JWT via @CurrentUser(), never off a
// client-supplied param or body).
@ApiTags('Subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('current')
  @ApiOperation({ summary: "Get the current company's subscription" })
  getCurrent(@CurrentUser() user: any) {
    return this.subscriptions.getCurrent(user.tenantId);
  }

  @Get('current/plan')
  @ApiOperation({ summary: "Get the plan the current company's subscription is on" })
  getCurrentPlan(@CurrentUser() user: any) {
    return this.subscriptions.getCurrentPlan(user.tenantId);
  }

  @Get('plans')
  @ApiOperation({ summary: 'List active, purchasable subscription plans' })
  listPlans() {
    // Not tenant-scoped — the plan catalog is global, not per-company data.
    return this.subscriptions.listAvailablePlans();
  }
}
