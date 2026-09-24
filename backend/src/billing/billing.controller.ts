import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CurrentUser } from '../common/decorators/user.decorator';

// Roadmap Phase 22 — "Customer can see billing records." No
// @RequirePermissions here, same reasoning as SubscriptionsController: any
// authenticated user of the tenant can view their own company's billing
// history, and every handler below scopes to tenantId off the verified JWT
// only — never a client-supplied tenant/company id — which is what "a
// company can only see its own subscription" (Phase 17's security note,
// equally true of billing) looks like here.
@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('payments')
  @ApiOperation({ summary: "Payment history for the caller's own company (every checkout attempt, most recent first)" })
  @ApiQuery({ name: 'limit', required: false, description: 'Max rows to return (default 50, capped at 200)' })
  listPayments(@CurrentUser() user: any, @Query('limit') limit?: string) {
    return this.billing.listPayments(user.tenantId, limit ? parseInt(limit, 10) : undefined);
  }

  @Get('invoices')
  @ApiOperation({ summary: "Invoice-like records for the caller's own company, derived from successful payments" })
  @ApiQuery({ name: 'limit', required: false, description: 'Max rows to return (default 50, capped at 200)' })
  listInvoices(@CurrentUser() user: any, @Query('limit') limit?: string) {
    return this.billing.listInvoices(user.tenantId, limit ? parseInt(limit, 10) : undefined);
  }

  @Get('subscriptions')
  @ApiOperation({ summary: "Subscription/renewal history for the caller's own company (every subscription row, most recent first)" })
  @ApiQuery({ name: 'limit', required: false, description: 'Max rows to return (default 50, capped at 200)' })
  listSubscriptionHistory(@CurrentUser() user: any, @Query('limit') limit?: string) {
    return this.billing.listSubscriptionHistory(user.tenantId, limit ? parseInt(limit, 10) : undefined);
  }
}
