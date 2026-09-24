import { IsString, IsNotEmpty, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Deliberately has no tenantId or amount field — tenantId always comes from
// the caller's own session, and the amount is derived server-side from the
// subscription's current plan (see SubscriptionCheckoutService.createCheckout),
// never trusted from the client.
export class CreateSubscriptionCheckoutDto {
  @ApiProperty({ description: "Must be the caller's own company's current subscription id" })
  @IsString()
  @IsNotEmpty()
  subscriptionId: string;

  @ApiProperty({ example: 'https://app.example.com/billing/success' })
  @IsUrl({ require_tld: false })
  successUrl: string;

  @ApiProperty({ example: 'https://app.example.com/billing/cancelled' })
  @IsUrl({ require_tld: false })
  cancelUrl: string;
}
