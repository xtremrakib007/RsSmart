import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';
import { SubscriptionCheckoutService } from './subscription-checkout.service';
import { CreateSubscriptionCheckoutDto } from './dto/create-subscription-checkout.dto';
import { unwrapBillplzRedirectParams } from './providers/billplz-signature.util';

// Roadmap Phase 21 critical requirement: "A browser success redirect must
// NOT activate a subscription. Verified provider events must." That split
// is structural in this controller, not just a comment:
//   - checkoutRedirectStatus() (GET, authenticated, tenant-owned lookup)
//     only ever calls getCheckoutStatusForOwner(), which re-reads status
//     from the provider and never touches Subscription state.
//   - billplzWebhook() (POST, @Public(), signature-verified) is the ONLY
//     handler that reaches handleBillplzWebhook(), the only place that can
//     end up calling SubscriptionsService.activate().
// A browser landing on the redirect URL therefore has no code path to
// activate anything, no matter what query params it carries.
@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly checkouts: SubscriptionCheckoutService) {}

  @Post('checkout/subscription')
  @ApiBearerAuth()
  @RequirePermissions(Permission.SUBSCRIPTION_MANAGE)
  @ApiOperation({
    summary: 'Start a checkout to pay for the current company\'s subscription',
    description:
      'tenantId is taken from the session, never the request body. Returns a ' +
      "provider-hosted checkoutUrl to redirect the payer's browser to. Does not " +
      'activate the subscription — only the signed webhook (POST /payments/webhook/billplz) does.',
  })
  createCheckout(@CurrentUser() user: any, @Body() dto: CreateSubscriptionCheckoutDto) {
    return this.checkouts.createCheckout(user.tenantId, user.userId, dto.subscriptionId, dto.successUrl, dto.cancelUrl);
  }

  @Get('checkout/:providerReference/status')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Read-only checkout status for the post-payment redirect page',
    description:
      'Re-queries the payment provider directly and scopes the lookup to the ' +
      "caller's own tenant. Never activates a subscription — see this controller's " +
      'file comment. A different tenant\'s providerReference resolves to Not Found, ' +
      "never another company's checkout.",
  })
  checkoutStatus(@CurrentUser() user: any, @Param('providerReference') providerReference: string) {
    return this.checkouts.getCheckoutStatusForOwner(user.tenantId, providerReference);
  }

  @Post('webhook/billplz')
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({ summary: 'Billplz payment callback (X-Signature verified, not a user session)' })
  billplzWebhook(@Body() body: Record<string, string>) {
    return this.checkouts.handleBillplzWebhook(body);
  }

  // Convenience alias in case Billplz's redirect_url is pointed directly
  // at the API instead of the frontend — still read-only, still requires
  // the tenant's own session (a bare redirect query string is never
  // sufficient on its own; see file comment). Most deployments will point
  // redirect_url at the frontend, which then calls
  // GET /payments/checkout/:providerReference/status itself — this exists
  // for deployments that don't.
  @Get('checkout/redirect')
  @Public()
  @ApiOperation({ summary: 'Billplz browser redirect landing — read-only, never activates a subscription' })
  redirectLanding(@Query() query: Record<string, unknown>) {
    const fields = unwrapBillplzRedirectParams(query);
    return { providerReference: fields['id'] ?? null, note: 'Payment status is confirmed via the signed webhook, not this redirect.' };
  }
}
