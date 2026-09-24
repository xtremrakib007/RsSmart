import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { BillplzPaymentProvider } from './providers/billplz-payment.provider';
import { PAYMENT_PROVIDER, PAYMENT_PROVIDER_NAME } from './payments.constants';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { SubscriptionCheckoutService } from './subscription-checkout.service';
import { PaymentsController } from './payments.controller';

// Phase 20 only had 'mock'. Phase 21 adds 'billplz' — PaymentsService and
// everything above it are unaffected by this, which is the entire point of
// gating access behind PAYMENT_PROVIDER (see payments.service.ts).
function selectProvider(mock: MockPaymentProvider, billplz: BillplzPaymentProvider) {
  switch (PAYMENT_PROVIDER_NAME) {
    case 'mock':
      return mock;
    case 'billplz':
      return billplz;
    default:
      // Fail loud rather than silently falling back to the mock in an
      // environment that thought it configured a real provider — see
      // PAYMENT_PROVIDER_NAME's own comment in payments.constants.ts.
      throw new Error(
        `Unknown PAYMENT_PROVIDER '${PAYMENT_PROVIDER_NAME}' — 'mock' or 'billplz' are implemented as of Phase 21`,
      );
  }
}

@Module({
  imports: [AuditModule, PrismaModule, SubscriptionsModule],
  controllers: [PaymentsController],
  providers: [
    MockPaymentProvider,
    BillplzPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: selectProvider,
      inject: [MockPaymentProvider, BillplzPaymentProvider],
    },
    PaymentsService,
    SubscriptionCheckoutService,
  ],
  exports: [PaymentsService, SubscriptionCheckoutService],
})
export class PaymentsModule {}
