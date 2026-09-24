import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MockPaymentProvider } from './mock-payment.provider';

describe('MockPaymentProvider', () => {
  let provider: MockPaymentProvider;

  const baseParams = {
    tenantId: 'tenant-1',
    referenceType: 'Subscription',
    referenceId: 'sub-1',
    amount: { amount: 5000, currency: 'MYR' }, // RM 50.00
    description: 'Pro plan — monthly',
    successUrl: 'https://app.example.com/billing/success',
    cancelUrl: 'https://app.example.com/billing/cancel',
  };

  beforeEach(() => {
    provider = new MockPaymentProvider();
  });

  it('exposes provider identity and refund support flags', () => {
    expect(provider.name).toBe('mock');
    expect(provider.supportsRefunds).toBe(true);
  });

  describe('createCheckout', () => {
    it('creates a PENDING checkout with a mock provider reference and checkout URL', async () => {
      const result = await provider.createCheckout(baseParams);

      expect(result.status).toBe('PENDING');
      expect(result.providerReference).toMatch(/^mock_/);
      expect(result.checkoutUrl).toContain(result.providerReference);
      expect(result.amount).toEqual(baseParams.amount);
    });

    it('rejects a zero or negative amount', async () => {
      await expect(
        provider.createCheckout({ ...baseParams, amount: { amount: 0, currency: 'MYR' } }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        provider.createCheckout({ ...baseParams, amount: { amount: -100, currency: 'MYR' } }),
      ).rejects.toThrow(BadRequestException);
    });

    it('gives every checkout a distinct provider reference', async () => {
      const a = await provider.createCheckout(baseParams);
      const b = await provider.createCheckout(baseParams);

      expect(a.providerReference).not.toBe(b.providerReference);
    });
  });

  describe('verifyPayment / getPaymentStatus', () => {
    it('throws NotFound for an unknown reference', async () => {
      await expect(provider.verifyPayment('mock_does-not-exist')).rejects.toThrow(NotFoundException);
      await expect(provider.getPaymentStatus('mock_does-not-exist')).rejects.toThrow(NotFoundException);
    });

    it('reports PENDING with no paidAt before the checkout resolves', async () => {
      const { providerReference } = await provider.createCheckout(baseParams);

      const result = await provider.verifyPayment(providerReference);

      expect(result.status).toBe('PENDING');
      expect(result.paidAt).toBeNull();
    });

    it('reports SUCCEEDED with a paidAt after simulateSuccess', async () => {
      const { providerReference } = await provider.createCheckout(baseParams);
      provider.simulateSuccess(providerReference);

      const result = await provider.verifyPayment(providerReference);
      const status = await provider.getPaymentStatus(providerReference);

      expect(result.status).toBe('SUCCEEDED');
      expect(status).toBe('SUCCEEDED');
      expect(result.paidAt).toBeInstanceOf(Date);
    });

    it('reports FAILED after simulateFailure, with no paidAt', async () => {
      const { providerReference } = await provider.createCheckout(baseParams);
      provider.simulateFailure(providerReference);

      const result = await provider.verifyPayment(providerReference);

      expect(result.status).toBe('FAILED');
      expect(result.paidAt).toBeNull();
    });
  });

  describe('refund', () => {
    it('throws BadRequest when the underlying payment is not SUCCEEDED', async () => {
      const { providerReference } = await provider.createCheckout(baseParams);

      await expect(provider.refund({ providerReference })).rejects.toThrow(BadRequestException);
    });

    it('fully refunds a succeeded payment by default and flips status to REFUNDED', async () => {
      const { providerReference } = await provider.createCheckout(baseParams);
      provider.simulateSuccess(providerReference);

      const result = await provider.refund({ providerReference });

      expect(result.status).toBe('REFUNDED');
      expect(result.amount.amount).toBe(baseParams.amount.amount);
      expect(result.refundReference).toMatch(/^mock_refund_/);

      const status = await provider.getPaymentStatus(providerReference);
      expect(status).toBe('REFUNDED');
    });

    it('supports a partial refund and keeps the payment SUCCEEDED until fully refunded', async () => {
      const { providerReference } = await provider.createCheckout(baseParams);
      provider.simulateSuccess(providerReference);

      const partial = await provider.refund({ providerReference, amount: { amount: 2000, currency: 'MYR' } });

      expect(partial.status).toBe('SUCCEEDED');
      expect(partial.amount.amount).toBe(2000);

      const status = await provider.getPaymentStatus(providerReference);
      expect(status).toBe('SUCCEEDED');
    });

    it('rejects a refund amount greater than what remains unrefunded', async () => {
      const { providerReference } = await provider.createCheckout(baseParams);
      provider.simulateSuccess(providerReference);
      await provider.refund({ providerReference, amount: { amount: 4000, currency: 'MYR' } });

      await expect(
        provider.refund({ providerReference, amount: { amount: 2000, currency: 'MYR' } }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFound for an unknown reference', async () => {
      await expect(provider.refund({ providerReference: 'mock_does-not-exist' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reset', () => {
    it('clears all in-memory state', async () => {
      const { providerReference } = await provider.createCheckout(baseParams);
      provider.reset();

      await expect(provider.getPaymentStatus(providerReference)).rejects.toThrow(NotFoundException);
    });
  });
});
