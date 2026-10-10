import { Inject, Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PAYMENT_PROVIDER } from './payments.constants';
import {
  PaymentProviderAdapter,
  CreateCheckoutParams,
  CheckoutResult,
  PaymentVerificationResult,
  PaymentStatus,
  Money,
} from './interfaces/payment-provider.interface';

/**
 * The only thing in the app that should hold a reference to
 * PaymentProviderAdapter directly. Everything else (a future
 * PaymentsController in Phase 21, SubscriptionsService, etc.) goes through
 * this service, so swapping providers or adding cross-cutting behavior
 * (audit logging, tenant checks) happens in exactly one place.
 *
 * Known gap, deliberately not fixed here: verifyPayment / getPaymentStatus
 * / refund take a bare providerReference and do NOT check it belongs to
 * the calling tenant, because there is no local persistence yet mapping a
 * providerReference back to a tenantId to check against (see Phase 20 doc,
 * "Do not"). This is not yet an active vulnerability — nothing routes an
 * external HTTP request into this service yet, no controller exists in
 * this phase — but Phase 21, which adds the checkout endpoint and webhook
 * handler, MUST persist that mapping and add the check before exposing
 * these methods over HTTP.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(PAYMENT_PROVIDER) private provider: PaymentProviderAdapter,
    private audit: AuditService,
  ) {}

  get providerName(): string {
    return this.provider.name;
  }

  get supportsRefunds(): boolean {
    return this.provider.supportsRefunds;
  }

  async createCheckout(
    tenantId: string,
    actorUserId: string,
    params: Omit<CreateCheckoutParams, 'tenantId'>,
  ): Promise<CheckoutResult> {
    const result = await this.provider.createCheckout({ ...params, tenantId });

    await this.logAuditSafely({
      tenantId,
      userId: actorUserId,
      action: 'CREATE',
      entityType: 'PaymentCheckout',
      entityId: result.providerReference,
      newValues: {
        provider: this.provider.name,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        amount: params.amount.amount,
        currency: params.amount.currency,
      },
    });

    return result;
  }

  /** Read-only — not audit-logged, same as other services' list()/get() (see OutletsService). */
  async verifyPayment(providerReference: string): Promise<PaymentVerificationResult> {
    return this.provider.verifyPayment(providerReference);
  }

  /** Read-only — not audit-logged. */
  async getPaymentStatus(providerReference: string): Promise<PaymentStatus> {
    return this.provider.getPaymentStatus(providerReference);
  }

  async refund(
    tenantId: string,
    actorUserId: string,
    providerReference: string,
    amount?: Money,
    reason?: string,
  ) {
    if (!this.provider.supportsRefunds) {
      throw new NotImplementedException(`Refunds are not supported by the '${this.provider.name}' payment provider`);
    }

    const result = await this.provider.refund({ providerReference, amount, reason });

    await this.logAuditSafely({
      tenantId,
      userId: actorUserId,
      action: 'UPDATE',
      entityType: 'PaymentCheckout',
      entityId: providerReference,
      newValues: {
        provider: this.provider.name,
        refundReference: result.refundReference,
        status: result.status,
        refundedAmount: result.amount.amount,
        reason,
      },
    });

    return result;
  }

  /**
   * A provider-side payment/refund may already have happened when audit
   * persistence fails. Do not turn that into a failed API response that
   * encourages callers to retry and potentially create another payment.
   * The failure is logged for operational alerting; audit storage should
   * still be monitored and repaired independently.
   */
  private async logAuditSafely(data: Parameters<AuditService['log']>[0]): Promise<void> {
    try {
      await this.audit.log(data);
    } catch (error) {
      this.logger.error(
        `Payment audit persistence failed for action ${data.action} on ${data.entityType}; provider operation remains successful`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
