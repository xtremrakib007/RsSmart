import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
  let prisma: any;
  let audit: { log: jest.Mock };
  let service: SubscriptionsService;

  const tenantId = 'tenant-1';
  const planId = 'plan-pro';

  beforeEach(() => {
    prisma = {
      subscription: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      subscriptionPlan: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };
    audit = { log: jest.fn() };
    service = new SubscriptionsService(prisma, audit as any);
  });

  describe('getCurrent', () => {
    it('throws NotFound when the tenant has never had a subscription', async () => {
      prisma.subscription.findFirst.mockResolvedValue(null);

      await expect(service.getCurrent(tenantId)).rejects.toThrow(NotFoundException);
    });

    it('returns the most recent subscription row', async () => {
      const latest = { id: 'sub-2', tenantId, status: 'ACTIVE' };
      prisma.subscription.findFirst.mockResolvedValue(latest);

      const result = await service.getCurrent(tenantId);

      expect(result).toBe(latest);
      expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getCurrentPlan', () => {
    it('returns the plan tied to the current subscription', async () => {
      prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', tenantId, planId, status: 'ACTIVE' });
      prisma.subscriptionPlan.findUnique.mockResolvedValue({ id: planId, name: 'Pro', isActive: true });

      const plan = await service.getCurrentPlan(tenantId);

      expect(plan).toEqual({ id: planId, name: 'Pro', isActive: true });
      expect(prisma.subscriptionPlan.findUnique).toHaveBeenCalledWith({ where: { id: planId } });
    });

    it('throws NotFound when the tenant has no subscription at all', async () => {
      prisma.subscription.findFirst.mockResolvedValue(null);

      await expect(service.getCurrentPlan(tenantId)).rejects.toThrow(NotFoundException);
    });

    it('still returns a plan the tenant is on even if it has since been retired from new sign-ups', async () => {
      // Distinguishes getCurrentPlan (viewing) from createTrial (starting) —
      // a retired plan (isActive: false) must not block a tenant from
      // seeing their own current plan, only from newly subscribing to it.
      prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', tenantId, planId, status: 'ACTIVE' });
      prisma.subscriptionPlan.findUnique.mockResolvedValue({ id: planId, name: 'Legacy Plan', isActive: false });

      const plan = await service.getCurrentPlan(tenantId);

      expect(plan).toEqual({ id: planId, name: 'Legacy Plan', isActive: false });
    });

    it('throws NotFound if the plan id on the subscription no longer resolves', async () => {
      prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', tenantId, planId, status: 'ACTIVE' });
      prisma.subscriptionPlan.findUnique.mockResolvedValue(null);

      await expect(service.getCurrentPlan(tenantId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('listAvailablePlans', () => {
    it('lists only active plans, ordered for display', async () => {
      const plans = [{ id: 'plan-a', sortOrder: 0 }, { id: 'plan-b', sortOrder: 1 }];
      prisma.subscriptionPlan.findMany.mockResolvedValue(plans);

      const result = await service.listAvailablePlans();

      expect(result).toBe(plans);
      expect(prisma.subscriptionPlan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
    });
  });

  describe('createTrial', () => {
    it('rejects a tenant that already has a live subscription', async () => {
      prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', tenantId, status: 'ACTIVE' });

      await expect(service.createTrial(tenantId, planId, 'actor-1')).rejects.toThrow(ConflictException);
      expect(prisma.subscription.create).not.toHaveBeenCalled();
    });

    it('allows a new trial once a prior subscription has ended', async () => {
      prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', tenantId, status: 'CANCELLED' });
      prisma.subscriptionPlan.findUnique.mockResolvedValue({ id: planId, isActive: true });
      prisma.subscription.create.mockResolvedValue({ id: 'sub-2', tenantId, planId, status: 'TRIALING' });

      const result = await service.createTrial(tenantId, planId, 'actor-1');

      expect(result.status).toBe('TRIALING');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId, action: 'SUBSCRIPTION_TRIAL_STARTED', entityType: 'Subscription' }),
      );
    });

    it('rejects an inactive/retired plan', async () => {
      prisma.subscription.findFirst.mockResolvedValue(null);
      prisma.subscriptionPlan.findUnique.mockResolvedValue({ id: planId, isActive: false });

      await expect(service.createTrial(tenantId, planId, 'actor-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects an unknown plan', async () => {
      prisma.subscription.findFirst.mockResolvedValue(null);
      prisma.subscriptionPlan.findUnique.mockResolvedValue(null);

      await expect(service.createTrial(tenantId, planId, 'actor-1')).rejects.toThrow(NotFoundException);
    });

    it('rejects a non-positive trial length', async () => {
      await expect(service.createTrial(tenantId, planId, 'actor-1', 0)).rejects.toThrow(BadRequestException);
    });
  });

  describe('activate', () => {
    it('throws NotFound for a subscription belonging to another tenant', async () => {
      prisma.subscription.findFirst.mockResolvedValue(null); // findFirst is tenant-scoped

      await expect(service.activate(tenantId, 'sub-from-another-company', 'actor-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('activates a trialing subscription', async () => {
      prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', tenantId, status: 'TRIALING', currentPeriodEnd: null });
      prisma.subscription.update.mockResolvedValue({ id: 'sub-1', tenantId, status: 'ACTIVE' });

      const result = await service.activate(tenantId, 'sub-1', 'actor-1');

      expect(result.status).toBe('ACTIVE');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'SUBSCRIPTION_ACTIVATED' }));
    });

    it('refuses to activate a cancelled subscription', async () => {
      prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', tenantId, status: 'CANCELLED' });

      await expect(service.activate(tenantId, 'sub-1', 'actor-1')).rejects.toThrow(BadRequestException);
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });

    it('is idempotent when activating an already-active subscription', async () => {
      const existing = { id: 'sub-1', tenantId, status: 'ACTIVE' };
      prisma.subscription.findFirst.mockResolvedValue(existing);

      const result = await service.activate(tenantId, 'sub-1', 'actor-1');

      expect(result).toBe(existing);
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('schedules cancellation at period end by default without changing status yet', async () => {
      prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', tenantId, status: 'ACTIVE' });
      prisma.subscription.update.mockResolvedValue({ id: 'sub-1', tenantId, status: 'ACTIVE', cancelAtPeriodEnd: true });

      const result = await service.cancel(tenantId, 'sub-1', 'actor-1');

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { cancelAtPeriodEnd: true },
      });
      expect(result.cancelAtPeriodEnd).toBe(true);
    });

    it('cancels immediately when atPeriodEnd is false', async () => {
      prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', tenantId, status: 'ACTIVE' });
      prisma.subscription.update.mockResolvedValue({ id: 'sub-1', tenantId, status: 'CANCELLED' });

      const result = await service.cancel(tenantId, 'sub-1', 'actor-1', { atPeriodEnd: false });

      expect(result.status).toBe('CANCELLED');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'SUBSCRIPTION_CANCELLED' }));
    });

    it('is idempotent when cancelling an already-cancelled subscription', async () => {
      const existing = { id: 'sub-1', tenantId, status: 'CANCELLED' };
      prisma.subscription.findFirst.mockResolvedValue(existing);

      const result = await service.cancel(tenantId, 'sub-1', 'actor-1', { atPeriodEnd: false });

      expect(result).toBe(existing);
      expect(prisma.subscription.update).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('refuses to schedule cancellation on an already-cancelled subscription', async () => {
      prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', tenantId, status: 'CANCELLED' });

      await expect(service.cancel(tenantId, 'sub-1', 'actor-1', { atPeriodEnd: true })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('suspend', () => {
    it('suspends an active subscription', async () => {
      prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', tenantId, status: 'ACTIVE' });
      prisma.subscription.update.mockResolvedValue({ id: 'sub-1', tenantId, status: 'SUSPENDED' });

      const result = await service.suspend(tenantId, 'sub-1', 'actor-1', 'payment failed');

      expect(result.status).toBe('SUSPENDED');
    });

    it('allows suspending a trialing subscription (e.g. a fraud/abuse hold)', async () => {
      prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', tenantId, status: 'TRIALING' });
      prisma.subscription.update.mockResolvedValue({ id: 'sub-1', tenantId, status: 'SUSPENDED' });

      const result = await service.suspend(tenantId, 'sub-1', 'actor-1');

      expect(result.status).toBe('SUSPENDED');
    });

    it('refuses to suspend an expired subscription', async () => {
      prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', tenantId, status: 'EXPIRED' });

      await expect(service.suspend(tenantId, 'sub-1', 'actor-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('expire', () => {
    it('expires an active subscription', async () => {
      prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', tenantId, status: 'ACTIVE' });
      prisma.subscription.update.mockResolvedValue({ id: 'sub-1', tenantId, status: 'EXPIRED' });

      const result = await service.expire(tenantId, 'sub-1');

      expect(result.status).toBe('EXPIRED');
    });

    it('refuses to expire an already-cancelled subscription', async () => {
      prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', tenantId, status: 'CANCELLED' });

      await expect(service.expire(tenantId, 'sub-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('isActive / getStatus', () => {
    it('returns false when the tenant has no subscription', async () => {
      prisma.subscription.findFirst.mockResolvedValue(null);

      expect(await service.isActive(tenantId)).toBe(false);
      expect(await service.getStatus(tenantId)).toBe('NONE');
    });

    it('returns true for an active subscription within its period', async () => {
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
      prisma.subscription.findFirst.mockResolvedValue({ status: 'ACTIVE', currentPeriodEnd: future, trialEndsAt: null });

      expect(await service.isActive(tenantId)).toBe(true);
    });

    it('returns false for an active subscription whose period has already lapsed', async () => {
      const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
      prisma.subscription.findFirst.mockResolvedValue({ status: 'ACTIVE', currentPeriodEnd: past, trialEndsAt: null });

      expect(await service.isActive(tenantId)).toBe(false);
    });

    it('returns false for a suspended subscription even within its period', async () => {
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
      prisma.subscription.findFirst.mockResolvedValue({ status: 'SUSPENDED', currentPeriodEnd: future, trialEndsAt: null });

      expect(await service.isActive(tenantId)).toBe(false);
    });
  });
});
