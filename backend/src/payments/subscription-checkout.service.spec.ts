import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { SubscriptionCheckoutService } from './subscription-checkout.service';

const SIGNATURE_KEY = 'test-x-signature-key';

function sign(fields: Record<string, string>): string {
  const sourceString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('|');
  return createHmac('sha256', SIGNATURE_KEY).update(sourceString).digest('hex');
}

describe('SubscriptionCheckoutService', () => {
  let prisma: any;
  let audit: { log: jest.Mock };
  let payments: any;
  let subscriptions: any;
  let service: SubscriptionCheckoutService;
  const ORIGINAL_ENV = process.env;

  const tenantId = 'tenant-1';
  const subscriptionId = 'sub-1';

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, BILLPLZ_X_SIGNATURE_KEY: SIGNATURE_KEY };

    prisma = {
      subscriptionCheckout: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    audit = { log: jest.fn() };
    payments = {
      providerName: 'billplz',
      createCheckout: jest.fn(),
      verifyPayment: jest.fn(),
    };
    subscriptions = {
      getCurrent: jest.fn(),
      getCurrentPlan: jest.fn(),
      activate: jest.fn(),
    };

    service = new SubscriptionCheckoutService(prisma, audit as any, payments, subscriptions);
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('createCheckout', () => {
    it('derives the amount from the current plan, never a client-supplied amount', async () => {
      subscriptions.getCurrent.mockResolvedValue({ id: subscriptionId, tenantId });
      subscriptions.getCurrentPlan.mockResolvedValue({ id: 'plan-pro', name: 'Pro', priceMonthly: '99.00', currency: 'MYR' });
      payments.createCheckout.mockResolvedValue({ providerReference: 'bill_abc', checkoutUrl: 'https://x', status: 'PENDING' });
      prisma.subscriptionCheckout.create.mockResolvedValue({ id: 'checkout-1' });

      await service.createCheckout(tenantId, 'user-1', subscriptionId, 'https://x/success', 'https://x/cancel');

      expect(payments.createCheckout).toHaveBeenCalledWith(
        tenantId,
        'user-1',
        expect.objectContaining({ amount: { amount: 9900, currency: 'MYR' } }),
      );
    });

    it('keeps an immediately successful provider checkout pending until the signed webhook finalizes it', async () => {
      subscriptions.getCurrent.mockResolvedValue({ id: subscriptionId, tenantId });
      subscriptions.getCurrentPlan.mockResolvedValue({ id: 'plan-pro', name: 'Pro', priceMonthly: '99.00', currency: 'MYR' });
      payments.createCheckout.mockResolvedValue({
        providerReference: 'bill_paid_immediately',
        checkoutUrl: 'https://pay',
        status: 'SUCCEEDED',
      });
      prisma.subscriptionCheckout.create.mockResolvedValue({ id: 'checkout-1', status: 'PENDING' });

      await service.createCheckout(tenantId, 'user-1', subscriptionId, 'https://x/success', 'https://x/cancel');

      expect(prisma.subscriptionCheckout.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          providerReference: 'bill_paid_immediately',
          status: 'PENDING',
        }),
      });
      expect(subscriptions.activate).not.toHaveBeenCalled();
    });

    it('rejects invalid plan amounts before calling the payment provider', async () => {
      subscriptions.getCurrent.mockResolvedValue({ id: subscriptionId, tenantId });
      subscriptions.getCurrentPlan.mockResolvedValue({ id: 'plan-pro', name: 'Pro', priceMonthly: 'NaN', currency: 'MYR' });

      await expect(
        service.createCheckout(tenantId, 'user-1', subscriptionId, 'https://x/success', 'https://x/cancel'),
      ).rejects.toThrow('Subscription plan has an invalid payment amount or currency');
      expect(payments.createCheckout).not.toHaveBeenCalled();
      expect(prisma.subscriptionCheckout.create).not.toHaveBeenCalled();
    });

    it('does not persist a provider checkout with an insecure redirect URL', async () => {
      subscriptions.getCurrent.mockResolvedValue({ id: subscriptionId, tenantId });
      subscriptions.getCurrentPlan.mockResolvedValue({ id: 'plan-pro', name: 'Pro', priceMonthly: '99.00', currency: 'MYR' });
      payments.createCheckout.mockResolvedValue({ providerReference: 'bill_abc', checkoutUrl: 'http://untrusted.example/pay', status: 'PENDING' });

      await expect(
        service.createCheckout(tenantId, 'user-1', subscriptionId, 'https://x/success', 'https://x/cancel'),
      ).rejects.toThrow('Payment provider returned an invalid checkout reference or URL');
      expect(prisma.subscriptionCheckout.create).not.toHaveBeenCalled();
    });

    it('rejects a subscriptionId that is not the caller tenant\'s current subscription', async () => {
      subscriptions.getCurrent.mockResolvedValue({ id: 'sub-other', tenantId });

      await expect(
        service.createCheckout(tenantId, 'user-1', 'sub-not-mine', 'https://x/success', 'https://x/cancel'),
      ).rejects.toThrow(NotFoundException);
      expect(payments.createCheckout).not.toHaveBeenCalled();
    });

    it('persists the checkout row keyed on the provider reference', async () => {
      subscriptions.getCurrent.mockResolvedValue({ id: subscriptionId, tenantId });
      subscriptions.getCurrentPlan.mockResolvedValue({ id: 'plan-pro', name: 'Pro', priceMonthly: '99.00', currency: 'MYR' });
      payments.createCheckout.mockResolvedValue({ providerReference: 'bill_abc', checkoutUrl: 'https://pay', status: 'PENDING' });
      prisma.subscriptionCheckout.create.mockResolvedValue({ id: 'checkout-1' });

      await service.createCheckout(tenantId, 'user-1', subscriptionId, 'https://x/success', 'https://x/cancel');

      expect(prisma.subscriptionCheckout.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          subscriptionId,
          planId: 'plan-pro',
          provider: 'billplz',
          providerReference: 'bill_abc',
          status: 'PENDING',
        }),
      });
    });
  });

  describe('getCheckoutStatusForOwner', () => {
    it('scopes the lookup to the caller\'s own tenant', async () => {
      prisma.subscriptionCheckout.findFirst.mockResolvedValue({ id: 'checkout-1', tenantId, providerReference: 'bill_abc', amount: '99.00', currency: 'MYR' });
      payments.verifyPayment.mockResolvedValue({ status: 'SUCCEEDED', amount: { amount: 9900, currency: 'MYR' }, paidAt: new Date() });

      await service.getCheckoutStatusForOwner(tenantId, 'bill_abc');

      expect(prisma.subscriptionCheckout.findFirst).toHaveBeenCalledWith({
        where: { providerReference: 'bill_abc', tenantId },
      });
    });

    it('throws NotFound for another tenant\'s providerReference rather than leaking it', async () => {
      prisma.subscriptionCheckout.findFirst.mockResolvedValue(null);

      await expect(service.getCheckoutStatusForOwner(tenantId, 'bill_other_tenant')).rejects.toThrow(NotFoundException);
      expect(payments.verifyPayment).not.toHaveBeenCalled();
    });

    it('re-queries the provider rather than trusting the locally stored status', async () => {
      prisma.subscriptionCheckout.findFirst.mockResolvedValue({ id: 'checkout-1', tenantId, providerReference: 'bill_abc', status: 'PENDING', amount: '99.00', currency: 'MYR' });
      payments.verifyPayment.mockResolvedValue({ status: 'SUCCEEDED', amount: { amount: 9900, currency: 'MYR' }, paidAt: new Date() });

      const result = await service.getCheckoutStatusForOwner(tenantId, 'bill_abc');

      expect(payments.verifyPayment).toHaveBeenCalledWith('bill_abc');
      expect(result.status).toBe('SUCCEEDED');
    });

    it('rejects provider success when the verified amount or currency differs from the stored checkout', async () => {
      prisma.subscriptionCheckout.findFirst.mockResolvedValue({
        id: 'checkout-1', tenantId, providerReference: 'bill_abc', amount: '99.00', currency: 'MYR',
      });
      payments.verifyPayment.mockResolvedValue({
        status: 'SUCCEEDED', amount: { amount: 1, currency: 'USD' }, paidAt: new Date(),
      });

      await expect(service.getCheckoutStatusForOwner(tenantId, 'bill_abc'))
        .rejects.toThrow('Verified payment amount or currency does not match checkout');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'SUBSCRIPTION_CHECKOUT_STATUS_MISMATCH',
        entityType: 'SubscriptionCheckout',
        entityId: 'checkout-1',
      }));
      expect(subscriptions.activate).not.toHaveBeenCalled();
    });

    it('never calls SubscriptionsService.activate — a redirect-facing read must not activate anything', async () => {
      prisma.subscriptionCheckout.findFirst.mockResolvedValue({ id: 'checkout-1', tenantId, providerReference: 'bill_abc', amount: '99.00', currency: 'MYR' });
      payments.verifyPayment.mockResolvedValue({ status: 'SUCCEEDED', amount: { amount: 9900, currency: 'MYR' }, paidAt: new Date() });

      await service.getCheckoutStatusForOwner(tenantId, 'bill_abc');

      expect(subscriptions.activate).not.toHaveBeenCalled();
    });
  });

  describe('handleBillplzWebhook', () => {
    const fields = { id: 'bill_abc', collection_id: 'col_1', paid: 'true', amount: '9900', state: 'paid' };

    it('rejects an unsigned/invalid webhook without touching the database', async () => {
      await expect(service.handleBillplzWebhook({ ...fields, x_signature: 'bogus' })).rejects.toThrow(UnauthorizedException);
      expect(prisma.subscriptionCheckout.findUnique).not.toHaveBeenCalled();
    });

    it('throws if BILLPLZ_X_SIGNATURE_KEY is not configured, rather than skipping verification', async () => {
      delete process.env.BILLPLZ_X_SIGNATURE_KEY;
      const x_signature = sign(fields);
      await expect(service.handleBillplzWebhook({ ...fields, x_signature })).rejects.toThrow(BadRequestException);
    });

    it('accepts (200-equivalent) but does not error on a signed webhook for an unknown bill', async () => {
      const x_signature = sign(fields);
      prisma.subscriptionCheckout.findUnique.mockResolvedValue(null);

      const result = await service.handleBillplzWebhook({ ...fields, x_signature });

      expect(result).toEqual({ received: true, matched: false });
      expect(subscriptions.activate).not.toHaveBeenCalled();
    });

    it('rejects a Billplz callback when the checkout belongs to another provider', async () => {
      const x_signature = sign(fields);
      prisma.subscriptionCheckout.findUnique.mockResolvedValue({
        id: 'checkout-1',
        tenantId,
        subscriptionId,
        provider: 'stripe',
        providerReference: 'bill_abc',
        status: 'PENDING',
        amount: '99.00',
        currency: 'MYR',
        webhookProcessedAt: null,
      });

      const result = await service.handleBillplzWebhook({ ...fields, x_signature });

      expect(result).toEqual({ received: true, matched: false });
      expect(payments.verifyPayment).not.toHaveBeenCalled();
      expect(subscriptions.activate).not.toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'SUBSCRIPTION_CHECKOUT_PROVIDER_MISMATCH',
        entityType: 'SubscriptionCheckout',
        entityId: 'checkout-1',
      }));
    });

    it('is idempotent: a second webhook for an already-processed checkout is a no-op', async () => {
      const x_signature = sign(fields);
      prisma.subscriptionCheckout.findUnique.mockResolvedValue({
        id: 'checkout-1',
        tenantId,
        subscriptionId,
        providerReference: 'bill_abc',
        status: 'SUCCEEDED',
        webhookProcessedAt: new Date('2026-08-30T09:00:00Z'),
      });

      const result = await service.handleBillplzWebhook({ ...fields, x_signature });

      expect(result).toEqual({ received: true, duplicate: true, status: 'SUCCEEDED' });
      expect(payments.verifyPayment).not.toHaveBeenCalled();
      expect(subscriptions.activate).not.toHaveBeenCalled();
    });

    it('re-verifies against the provider rather than trusting the webhook payload\'s own paid field', async () => {
      const x_signature = sign(fields); // payload claims paid: 'true'
      prisma.subscriptionCheckout.findUnique.mockResolvedValue({
        id: 'checkout-1',
        tenantId,
        subscriptionId,
        providerReference: 'bill_abc',
        status: 'PENDING',
        amount: '99.00',
        currency: 'MYR',
        webhookProcessedAt: null,
      });
      // ...but the provider itself still reports PENDING (e.g. a stale/forged replay).
      payments.verifyPayment.mockResolvedValue({ status: 'PENDING', amount: { amount: 9900, currency: 'MYR' }, paidAt: null });

      const result = await service.handleBillplzWebhook({ ...fields, x_signature });

      expect(payments.verifyPayment).toHaveBeenCalledWith('bill_abc');
      expect(subscriptions.activate).not.toHaveBeenCalled();
      expect(result.status).toBe('PENDING');
    });

    it('activates the subscription only once the provider itself confirms SUCCEEDED', async () => {
      const x_signature = sign(fields);
      prisma.subscriptionCheckout.findUnique.mockResolvedValue({
        id: 'checkout-1',
        tenantId,
        subscriptionId,
        providerReference: 'bill_abc',
        status: 'PENDING',
        amount: '99.00',
        currency: 'MYR',
        webhookProcessedAt: null,
      });
      payments.verifyPayment.mockResolvedValue({ status: 'SUCCEEDED', amount: { amount: 9900, currency: 'MYR' }, paidAt: new Date() });

      const result = await service.handleBillplzWebhook({ ...fields, x_signature });

      expect(prisma.subscriptionCheckout.update).toHaveBeenCalledWith({
        where: { id: 'checkout-1' },
        data: expect.objectContaining({ status: 'SUCCEEDED' }),
      });
      expect(subscriptions.activate).toHaveBeenCalledWith(tenantId, subscriptionId, 'system:billplz-webhook');
      expect(result).toEqual({ received: true, status: 'SUCCEEDED' });
    });

    it('returns success if audit persistence fails after checkout finalization', async () => {
      const x_signature = sign(fields);
      prisma.subscriptionCheckout.findUnique.mockResolvedValue({
        id: 'checkout-1',
        tenantId,
        subscriptionId,
        provider: 'billplz',
        providerReference: 'bill_abc',
        status: 'PENDING',
        amount: '99.00',
        currency: 'MYR',
        webhookProcessedAt: null,
      });
      payments.verifyPayment.mockResolvedValue({ status: 'SUCCEEDED', amount: { amount: 9900, currency: 'MYR' }, paidAt: new Date() });
      audit.log.mockRejectedValue(new Error('audit database unavailable'));

      await expect(service.handleBillplzWebhook({ ...fields, x_signature }))
        .resolves.toEqual({ received: true, status: 'SUCCEEDED' });
      expect(subscriptions.activate).toHaveBeenCalledTimes(1);
      expect(prisma.subscriptionCheckout.update).toHaveBeenCalledWith({
        where: { id: 'checkout-1' },
        data: expect.objectContaining({ status: 'SUCCEEDED' }),
      });
    });

    it('does not activate when another webhook worker owns the lease', async () => {
      const x_signature = sign(fields);
      prisma.subscriptionCheckout.findUnique
        .mockResolvedValueOnce({
          id: 'checkout-1', tenantId, subscriptionId, providerReference: 'bill_abc',
          status: 'PENDING', amount: '99.00', currency: 'MYR', webhookProcessedAt: null,
        })
        .mockResolvedValueOnce({
          id: 'checkout-1', tenantId, subscriptionId, providerReference: 'bill_abc',
          status: 'PENDING', amount: '99.00', currency: 'MYR', webhookProcessedAt: null,
          webhookProcessingAt: new Date(),
        });
      payments.verifyPayment.mockResolvedValue({
        status: 'SUCCEEDED', amount: { amount: 9900, currency: 'MYR' }, paidAt: new Date(),
      });
      prisma.subscriptionCheckout.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.handleBillplzWebhook({ ...fields, x_signature });

      expect(subscriptions.activate).not.toHaveBeenCalled();
      expect(result).toEqual({ received: true, processing: true, status: 'PENDING' });
    });

    it('leaves a successful checkout retryable when subscription activation fails', async () => {
      const x_signature = sign(fields);
      prisma.subscriptionCheckout.findUnique.mockResolvedValue({
        id: 'checkout-1',
        tenantId,
        subscriptionId,
        providerReference: 'bill_abc',
        status: 'PENDING',
        amount: '99.00',
        currency: 'MYR',
        webhookProcessedAt: null,
      });
      payments.verifyPayment.mockResolvedValue({
        status: 'SUCCEEDED',
        amount: { amount: 9900, currency: 'MYR' },
        paidAt: new Date(),
      });
      subscriptions.activate.mockRejectedValue(new Error('temporary database failure'));
      prisma.subscriptionCheckout.updateMany.mockResolvedValueOnce({ count: 1 }).mockRejectedValueOnce(new Error('lease cleanup failure'));

      await expect(service.handleBillplzWebhook({ ...fields, x_signature })).rejects.toThrow(
        'temporary database failure',
      );

      expect(subscriptions.activate).toHaveBeenCalledWith(tenantId, subscriptionId, 'system:billplz-webhook');
      expect(prisma.subscriptionCheckout.updateMany).toHaveBeenCalledTimes(2);
      expect(prisma.subscriptionCheckout.updateMany).toHaveBeenLastCalledWith({
        where: expect.objectContaining({ id: 'checkout-1', webhookProcessedAt: null }),
        data: { webhookProcessingAt: null },
      });
      expect(prisma.subscriptionCheckout.update).not.toHaveBeenCalled();
    });

    it('audit-logs the activation without a human userId (webhook-driven)', async () => {
      const x_signature = sign(fields);
      prisma.subscriptionCheckout.findUnique.mockResolvedValue({
        id: 'checkout-1',
        tenantId,
        subscriptionId,
        providerReference: 'bill_abc',
        status: 'PENDING',
        amount: '99.00',
        currency: 'MYR',
        webhookProcessedAt: null,
      });
      payments.verifyPayment.mockResolvedValue({ status: 'SUCCEEDED', amount: { amount: 9900, currency: 'MYR' }, paidAt: new Date() });

      await service.handleBillplzWebhook({ ...fields, x_signature });

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId, userId: undefined, action: 'SUBSCRIPTION_CHECKOUT_SUCCEEDED' }),
      );
    });
  });

  describe('reconcilePendingBillplzCheckouts', () => {
    it('reconciles only stored pending Billplz checkouts through the verified webhook finalizer', async () => {
      const checkout = {
        id: 'checkout-1',
        tenantId,
        subscriptionId,
        provider: 'billplz',
        providerReference: 'bill_abc',
        status: 'PENDING',
        amount: '99.00',
        currency: 'MYR',
        webhookProcessedAt: null,
        webhookProcessingAt: null,
        createdAt: new Date('2026-10-01T00:00:00Z'),
        updatedAt: new Date('2026-10-01T00:00:00Z'),
      };
      prisma.subscriptionCheckout.findMany.mockResolvedValue([checkout]);
      prisma.subscriptionCheckout.findUnique.mockResolvedValue(checkout);
      payments.verifyPayment.mockResolvedValue({
        status: 'SUCCEEDED',
        amount: { amount: 9900, currency: 'MYR' },
        paidAt: new Date(),
      });

      const result = await service.reconcilePendingBillplzCheckouts();

      expect(prisma.subscriptionCheckout.findMany).toHaveBeenCalledWith({
        where: { provider: 'billplz', status: 'PENDING', webhookProcessedAt: null },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      expect(payments.verifyPayment).toHaveBeenCalledTimes(2);
      expect(subscriptions.activate).toHaveBeenCalledWith(tenantId, subscriptionId, 'system:billplz-webhook');
      expect(result).toEqual({ checked: 1, finalized: 1, stillPending: 0, failed: 0 });
    });

    it('fails closed when the Billplz signature key is missing', async () => {
      delete process.env.BILLPLZ_X_SIGNATURE_KEY;

      await expect(service.reconcilePendingBillplzCheckouts()).rejects.toThrow(BadRequestException);
      expect(prisma.subscriptionCheckout.findMany).not.toHaveBeenCalled();
    });
  });
});
