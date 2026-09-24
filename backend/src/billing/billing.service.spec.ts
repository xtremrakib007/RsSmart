import { BillingService } from './billing.service';

describe('BillingService', () => {
  let prisma: any;
  let service: BillingService;

  const tenantId = 'tenant-1';

  beforeEach(() => {
    prisma = {
      subscriptionCheckout: {
        findMany: jest.fn(),
      },
      subscription: {
        findMany: jest.fn(),
      },
    };
    service = new BillingService(prisma);
  });

  describe('listPayments', () => {
    it('scopes the query to the tenant and orders most-recent-first', async () => {
      prisma.subscriptionCheckout.findMany.mockResolvedValue([]);

      await service.listPayments(tenantId);

      expect(prisma.subscriptionCheckout.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('defaults to 50 rows and caps an oversized limit at 200', async () => {
      prisma.subscriptionCheckout.findMany.mockResolvedValue([]);

      await service.listPayments(tenantId);
      expect(prisma.subscriptionCheckout.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));

      await service.listPayments(tenantId, 9999);
      expect(prisma.subscriptionCheckout.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 200 }));
    });

    it('ignores a non-positive or garbage limit and falls back to the default', async () => {
      prisma.subscriptionCheckout.findMany.mockResolvedValue([]);

      await service.listPayments(tenantId, -5);
      expect(prisma.subscriptionCheckout.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ take: 50 }));

      await service.listPayments(tenantId, NaN);
      expect(prisma.subscriptionCheckout.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ take: 50 }));
    });

    it('includes failed/pending/cancelled attempts, not just successful ones', async () => {
      const rows = [
        { id: 'c1', tenantId, subscriptionId: 's1', planId: 'p1', provider: 'billplz', providerReference: 'ref1', status: 'FAILED', amount: 10, currency: 'MYR', webhookProcessedAt: null, createdAt: new Date('2026-01-01'), subscription: null },
        { id: 'c2', tenantId, subscriptionId: 's1', planId: 'p1', provider: 'billplz', providerReference: 'ref2', status: 'SUCCEEDED', amount: 10, currency: 'MYR', webhookProcessedAt: new Date('2026-01-02'), createdAt: new Date('2026-01-01'), subscription: { plan: { name: 'Pro', slug: 'pro' } } },
      ];
      prisma.subscriptionCheckout.findMany.mockResolvedValue(rows);

      const result = await service.listPayments(tenantId);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ status: 'FAILED', paidAt: null, planName: null });
      expect(result[1]).toMatchObject({ status: 'SUCCEEDED', paidAt: new Date('2026-01-02'), planName: 'Pro' });
    });

    it('does not surface paidAt for a checkout that is not SUCCEEDED, even if webhookProcessedAt is set', async () => {
      const rows = [
        { id: 'c1', tenantId, subscriptionId: 's1', planId: 'p1', provider: 'billplz', providerReference: 'ref1', status: 'CANCELLED', amount: 10, currency: 'MYR', webhookProcessedAt: new Date('2026-01-02'), createdAt: new Date('2026-01-01'), subscription: null },
      ];
      prisma.subscriptionCheckout.findMany.mockResolvedValue(rows);

      const result = await service.listPayments(tenantId);

      expect(result[0].paidAt).toBeNull();
    });
  });

  describe('listInvoices', () => {
    it('only queries SUCCEEDED checkouts', async () => {
      prisma.subscriptionCheckout.findMany.mockResolvedValue([]);

      await service.listInvoices(tenantId);

      expect(prisma.subscriptionCheckout.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId, status: 'SUCCEEDED' } }),
      );
    });

    it('derives a deterministic invoice number from the checkout date and id', async () => {
      const rows = [
        {
          id: 'abcd1234-ef00-0000-0000-000000000000',
          tenantId,
          subscriptionId: 's1',
          planId: 'p1',
          provider: 'billplz',
          providerReference: 'ref1',
          status: 'SUCCEEDED',
          amount: 49,
          currency: 'MYR',
          webhookProcessedAt: new Date('2026-03-05T00:00:00Z'),
          createdAt: new Date('2026-03-01T00:00:00Z'),
          subscription: { plan: { name: 'Pro', slug: 'pro' } },
        },
      ];
      prisma.subscriptionCheckout.findMany.mockResolvedValue(rows);

      const result = await service.listInvoices(tenantId);

      expect(result[0]).toMatchObject({
        invoiceNumber: 'INV-202603-ABCD1234',
        planName: 'Pro',
        amount: 49,
        currency: 'MYR',
        issuedAt: new Date('2026-03-05T00:00:00Z'),
      });
    });

    it('falls back to createdAt for issuedAt when webhookProcessedAt is somehow missing', async () => {
      const rows = [
        {
          id: 'abcd1234-ef00-0000-0000-000000000000',
          tenantId,
          subscriptionId: 's1',
          planId: 'p1',
          provider: 'billplz',
          providerReference: 'ref1',
          status: 'SUCCEEDED',
          amount: 49,
          currency: 'MYR',
          webhookProcessedAt: null,
          createdAt: new Date('2026-03-01T00:00:00Z'),
          subscription: null,
        },
      ];
      prisma.subscriptionCheckout.findMany.mockResolvedValue(rows);

      const result = await service.listInvoices(tenantId);

      expect(result[0].issuedAt).toEqual(new Date('2026-03-01T00:00:00Z'));
    });
  });

  describe('listSubscriptionHistory', () => {
    it('scopes to the tenant, orders most-recent-first, and includes the plan name', async () => {
      const rows = [
        {
          id: 'sub-2',
          planId: 'plan-pro',
          status: 'ACTIVE',
          trialEndsAt: null,
          currentPeriodStart: new Date('2026-02-01'),
          currentPeriodEnd: new Date('2026-03-01'),
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          suspendedAt: null,
          createdAt: new Date('2026-02-01'),
          plan: { name: 'Pro', slug: 'pro', priceMonthly: 49, currency: 'MYR' },
        },
      ];
      prisma.subscription.findMany.mockResolvedValue(rows);

      const result = await service.listSubscriptionHistory(tenantId);

      expect(prisma.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId }, orderBy: { createdAt: 'desc' } }),
      );
      expect(result[0]).toMatchObject({ id: 'sub-2', planName: 'Pro', status: 'ACTIVE' });
    });

    it('never leaks another tenant\'s subscription rows into the result shape (query is the only isolation point)', async () => {
      prisma.subscription.findMany.mockResolvedValue([]);

      await service.listSubscriptionHistory('tenant-a');

      expect(prisma.subscription.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant-a' } }));
    });
  });
});
