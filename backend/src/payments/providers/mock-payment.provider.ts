import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  PaymentProviderAdapter,
  CreateCheckoutParams,
  CheckoutResult,
  PaymentVerificationResult,
  PaymentStatus,
  RefundParams,
  RefundResult,
  Money,
} from '../interfaces/payment-provider.interface';

interface MockRecord {
  providerReference: string;
  status: PaymentStatus;
  amount: Money;
  paidAt: Date | null;
  refundedAmount: number;
}

/**
 * Deterministic, in-memory stand-in for a real payment gateway. Used in
 * tests and as the default DI binding until Phase 21 selects a real
 * provider — see PaymentsModule.
 *
 * Unlike a real provider, nothing here ever transitions state on its own
 * (there's no actual payment page, no webhook). `simulateSuccess()` /
 * `simulateFailure()` exist ONLY for tests to drive a checkout to a
 * terminal state and are deliberately not part of PaymentProviderAdapter —
 * calling code that depends on the interface, not this class directly,
 * can never call them, which is the point (it forces Phase 21's
 * integration tests to go through the same createCheckout →
 * [webhook/verify] → status shape a real provider requires).
 *
 * State is process-memory only and reset on restart — correct for a mock
 * and a hard requirement to not persist anything provider-shaped in the
 * database before Phase 21 decides what a real provider's data actually
 * looks like.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProviderAdapter {
  readonly name = 'mock';
  readonly supportsRefunds = true;

  private records = new Map<string, MockRecord>();

  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
    if (params.amount.amount <= 0) {
      throw new BadRequestException('Checkout amount must be greater than zero');
    }

    const providerReference = `mock_${randomUUID()}`;
    const record: MockRecord = {
      providerReference,
      status: 'PENDING',
      amount: params.amount,
      paidAt: null,
      refundedAmount: 0,
    };
    this.records.set(providerReference, record);

    return {
      providerReference,
      // A real provider returns its own hosted page. This is the local/test
      // equivalent — resolvable to nothing outside this process, which is
      // fine since nothing outside this process's tests should ever
      // navigate to it.
      checkoutUrl: `https://mock-payment.local/checkout/${providerReference}`,
      status: record.status,
      amount: record.amount,
    };
  }

  async verifyPayment(providerReference: string): Promise<PaymentVerificationResult> {
    const record = this.getRecordOrThrow(providerReference);
    return {
      providerReference,
      status: record.status,
      amount: record.amount,
      paidAt: record.paidAt,
    };
  }

  async getPaymentStatus(providerReference: string): Promise<PaymentStatus> {
    return this.getRecordOrThrow(providerReference).status;
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    const record = this.getRecordOrThrow(params.providerReference);
    if (record.status !== 'SUCCEEDED') {
      throw new BadRequestException(`Cannot refund a payment with status ${record.status}`);
    }

    const refundAmount = params.amount?.amount ?? record.amount.amount;
    if (refundAmount <= 0 || refundAmount + record.refundedAmount > record.amount.amount) {
      throw new BadRequestException('Refund amount exceeds the original payment');
    }

    record.refundedAmount += refundAmount;
    if (record.refundedAmount >= record.amount.amount) {
      record.status = 'REFUNDED';
    }

    return {
      providerReference: record.providerReference,
      refundReference: `mock_refund_${randomUUID()}`,
      status: record.status,
      amount: { amount: refundAmount, currency: record.amount.currency },
    };
  }

  // ── Test-only helpers — NOT part of PaymentProviderAdapter ──────────────

  /** Drives a PENDING checkout to SUCCEEDED, as a real provider's webhook would report. Test-only. */
  simulateSuccess(providerReference: string): void {
    const record = this.getRecordOrThrow(providerReference);
    record.status = 'SUCCEEDED';
    record.paidAt = new Date();
  }

  /** Drives a PENDING checkout to FAILED. Test-only. */
  simulateFailure(providerReference: string): void {
    const record = this.getRecordOrThrow(providerReference);
    record.status = 'FAILED';
  }

  /** Wipes all in-memory state. Test-only — call between test cases that reuse a single provider instance. */
  reset(): void {
    this.records.clear();
  }

  private getRecordOrThrow(providerReference: string): MockRecord {
    const record = this.records.get(providerReference);
    if (!record) throw new NotFoundException('Payment reference not found');
    return record;
  }
}
