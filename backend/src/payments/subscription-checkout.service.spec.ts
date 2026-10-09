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
        findUnique: jest.fn(),
        update: jest.fn(),
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
      prisma.subscriptionCheckout.findFirst.mockResolvedValue({ id: 'checkout-1', tenantId, providerReference: 'bill_abc' });
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
      prisma.subscriptionCheckout.findFirst.mockResolvedValue({ id: 'checkout-1', tenantId, providerReference: 'bill_abc', status: 'PENDING' });
      payments.verifyPayment.mockResolvedValue({ status: 'SUCCEEDED', amount: { amount: 9900, currency: 'MYR' }, paidAt: new Date() });

      const result = await service.getCheckoutStatusForOwner(tenantId, 'bill_abc');

      expect(payments.verifyPayment).toHaveBeenCalledWith('bill_abc');
      expect(result.status).toBe('SUCCEEDED');
    });

    it('never calls SubscriptionsService.activate — a redirect-facing read must not activate anything', async () => {
      prisma.subscriptionCheckout.findFirst.mockResolvedValue({ id: 'checkout-1', tenantId, providerReference: 'bill_abc' });
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

    it('audit-logs the activation without a human userId (webhook-driven)', async () => {
      const x_signature = sign(fields);
      prisma.subscriptionCheckout.findUnique.mockResolvedValue({
        id: 'checkout-1',
        tenantId,
        subscriptionId,
        providerReference: 'bill_abc',
        status: 'PENDING',
        webhookProcessedAt: null,
      });
      payments.verifyPayment.mockResolvedValue({ status: 'SUCCEEDED', amount: { amount: 9900, currency: 'MYR' }, paidAt: new Date() });

      await service.handleBillplzWebhook({ ...fields, x_signature });

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId, userId: undefined, action: 'SUBSCRIPTION_CHECKOUT_SUCCEEDED' }),
      );
    });
  });
});
