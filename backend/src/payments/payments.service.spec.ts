import { NotImplementedException } from '@nestjs/common';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  let provider: {
    name: string;
    supportsRefunds: boolean;
    createCheckout: jest.Mock;
    verifyPayment: jest.Mock;
    getPaymentStatus: jest.Mock;
    refund: jest.Mock;
  };
  let audit: { log: jest.Mock };
  let service: PaymentsService;

  const tenantId = 'tenant-1';
  const actorUserId = 'user-1';

  beforeEach(() => {
    provider = {
      name: 'mock',
      supportsRefunds: true,
      createCheckout: jest.fn(),
      verifyPayment: jest.fn(),
      getPaymentStatus: jest.fn(),
      refund: jest.fn(),
    };
    audit = { log: jest.fn() };
    service = new PaymentsService(provider as any, audit as any);
  });

  it('exposes the bound provider name and refund support', () => {
    expect(service.providerName).toBe('mock');
    expect(service.supportsRefunds).toBe(true);
  });

  describe('createCheckout', () => {
    const params = {
      referenceType: 'Subscription',
      referenceId: 'sub-1',
      amount: { amount: 5000, currency: 'MYR' },
      description: 'Pro plan',
      successUrl: 'https://app.example.com/success',
      cancelUrl: 'https://app.example.com/cancel',
    };

    it('injects tenantId into the provider call without the caller having to pass it', async () => {
      provider.createCheckout.mockResolvedValue({
        providerReference: 'mock_abc',
        checkoutUrl: 'https://mock-payment.local/checkout/mock_abc',
        status: 'PENDING',
        amount: params.amount,
      });

      await service.createCheckout(tenantId, actorUserId, params);

      expect(provider.createCheckout).toHaveBeenCalledWith({ ...params, tenantId });
    });

    it('audits the checkout creation without leaking arbitrary metadata', async () => {
      provider.createCheckout.mockResolvedValue({
        providerReference: 'mock_abc',
        checkoutUrl: 'https://mock-payment.local/checkout/mock_abc',
        status: 'PENDING',
        amount: params.amount,
      });

      await service.createCheckout(tenantId, actorUserId, {
        ...params,
        metadata: { secretNote: 'should not be in the audit log' },
      });

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          userId: actorUserId,
          action: 'CREATE',
          entityType: 'PaymentCheckout',
          entityId: 'mock_abc',
        }),
      );
      const loggedCall = audit.log.mock.calls[0][0];
      expect(JSON.stringify(loggedCall)).not.toContain('secretNote');
    });

    it('returns the provider checkout even if audit persistence fails after provider creation', async () => {
      const providerResult = {
        providerReference: 'mock_audit_failure',
        checkoutUrl: 'https://mock-payment.local/checkout/mock_audit_failure',
        status: 'PENDING',
        amount: params.amount,
      };
      provider.createCheckout.mockResolvedValue(providerResult);
      audit.log.mockRejectedValue(new Error('audit database unavailable'));

      await expect(service.createCheckout(tenantId, actorUserId, params)).resolves.toBe(providerResult);
      expect(provider.createCheckout).toHaveBeenCalledTimes(1);
    });

    it('returns exactly what the provider returned', async () => {
      const providerResult = {
        providerReference: 'mock_xyz',
        checkoutUrl: 'https://mock-payment.local/checkout/mock_xyz',
        status: 'PENDING',
        amount: params.amount,
      };
      provider.createCheckout.mockResolvedValue(providerResult);

      const result = await service.createCheckout(tenantId, actorUserId, params);

      expect(result).toBe(providerResult);
    });
  });

  describe('verifyPayment / getPaymentStatus', () => {
    it('passes the reference straight through and does not audit-log (read-only)', async () => {
      provider.verifyPayment.mockResolvedValue({
        providerReference: 'mock_abc',
        status: 'SUCCEEDED',
        amount: { amount: 5000, currency: 'MYR' },
        paidAt: new Date(),
      });

      await service.verifyPayment('mock_abc');

      expect(provider.verifyPayment).toHaveBeenCalledWith('mock_abc');
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('getPaymentStatus passes the reference straight through and does not audit-log', async () => {
      provider.getPaymentStatus.mockResolvedValue('PENDING');

      const status = await service.getPaymentStatus('mock_abc');

      expect(status).toBe('PENDING');
      expect(provider.getPaymentStatus).toHaveBeenCalledWith('mock_abc');
      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  describe('refund', () => {
    it('throws NotImplemented when the bound provider does not support refunds, without calling it', async () => {
      provider.supportsRefunds = false;

      await expect(service.refund(tenantId, actorUserId, 'mock_abc')).rejects.toThrow(NotImplementedException);
      expect(provider.refund).not.toHaveBeenCalled();
    });

    it('returns a completed provider refund even if audit persistence fails', async () => {
      const providerResult = {
        providerReference: 'mock_abc',
        refundReference: 'mock_refund_audit_failure',
        status: 'REFUNDED',
        amount: { amount: 5000, currency: 'MYR' },
      };
      provider.refund.mockResolvedValue(providerResult);
      audit.log.mockRejectedValue(new Error('audit database unavailable'));

      await expect(service.refund(tenantId, actorUserId, 'mock_abc')).resolves.toBe(providerResult);
      expect(provider.refund).toHaveBeenCalledTimes(1);
    });

    it('delegates to the provider and audits the refund when supported', async () => {
      provider.refund.mockResolvedValue({
        providerReference: 'mock_abc',
        refundReference: 'mock_refund_1',
        status: 'REFUNDED',
        amount: { amount: 5000, currency: 'MYR' },
      });

      const result = await service.refund(tenantId, actorUserId, 'mock_abc', undefined, 'customer requested');

      expect(provider.refund).toHaveBeenCalledWith({
        providerReference: 'mock_abc',
        amount: undefined,
        reason: 'customer requested',
      });
      expect(result.status).toBe('REFUNDED');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          userId: actorUserId,
          action: 'UPDATE',
          entityType: 'PaymentCheckout',
          entityId: 'mock_abc',
          newValues: expect.objectContaining({ refundReference: 'mock_refund_1', status: 'REFUNDED' }),
        }),
      );
    });
  });
});
