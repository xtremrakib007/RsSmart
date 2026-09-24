import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EntitlementsService } from './entitlements.service';
import { CurrentUser } from '../common/decorators/user.decorator';

// Declared here (in EntitlementsModule) rather than alongside
// SubscriptionsController: EntitlementsModule already imports
// SubscriptionsModule for EntitlementsService's own use, and having
// SubscriptionsModule import EntitlementsModule back would make the two
// modules circular. Same route prefix as SubscriptionsController
// ('subscriptions') — Nest doesn't require one controller per prefix —
// so this reads as one API surface to callers even though it's declared
// in two files. See PHASE17-SUBSCRIPTION-API.md for the full reasoning.
//
// No @RequirePermissions — matches SubscriptionsController: any
// authenticated user of the tenant can see their own company's usage
// against its plan limits. tenantId always comes from the verified JWT,
// never a client-supplied param.
@ApiTags('Subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Get('limits')
  @ApiOperation({ summary: "Get the current company's plan limits and usage" })
  getLimits(@CurrentUser() user: any) {
    return this.entitlements.getUsageSummary(user.tenantId);
  }
}
