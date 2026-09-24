import { NotFoundException } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';

describe('EntitlementsService', () => {
  let prisma: any;
  let subscriptions: { getCurrent: jest.Mock };
  let service: EntitlementsService;

  const tenantId = 'tenant-1';
  const planId = 'plan-pro';

  const plan = {
    id: planId,
    maxOutlets: 3,
    maxUsers: 10,
    maxPosDevices: 5,
    features: { whatsapp: true, reports: false },
  };

  beforeEach(() => {
    prisma = {
      subscriptionPlan: { findUnique: jest.fn() },
      outlet: { count: jest.fn() },
      user: { count: jest.fn() },
      posSession: { findMany: jest.fn() },
    };
    subscriptions = { getCurrent: jest.fn() };
    service = new EntitlementsService(prisma, subscriptions as any);
  });

  describe('getPlanLimits', () => {
    it('reads limits from the plan tied to the tenant\'s current subscription', async () => {
      subscriptions.getCurrent.mockResolvedValue({ id: 'sub-1', tenantId, planId });
      prisma.subscriptionPlan.findUnique.mockResolvedValue(plan);

      const limits = await service.getPlanLimits(tenantId);

      expect(subscriptions.getCurrent).toHaveBeenCalledWith(tenantId);
      expect(prisma.subscriptionPlan.findUnique).toHaveBeenCalledWith({ where: { id: planId } });
      expect(limits).toEqual({
        maxOutlets: 3,
        maxUsers: 10,
        maxPosDevices: 5,
        features: { whatsapp: true, reports: false },
      });
    });

    it('propagates NotFoundException when the tenant has no subscription', async () => {
      subscriptions.getCurrent.mockRejectedValue(new NotFoundException('This company has no subscription yet'));

      await expect(service.getPlanLimits(tenantId)).rejects.toThrow(NotFoundException);
    });

    it('throws if the subscription points at a plan that no longer resolves', async () => {
      subscriptions.getCurrent.mockResolvedValue({ id: 'sub-1', tenantId, planId });
      prisma.subscriptionPlan.findUnique.mockResolvedValue(null);

      await expect(service.getPlanLimits(tenantId)).rejects.toThrow(NotFoundException);
    });

    it('defaults features to an empty object when the plan has none set', async () => {
      subscriptions.getCurrent.mockResolvedValue({ id: 'sub-1', tenantId, planId });
      prisma.subscriptionPlan.findUnique.mockResolvedValue({ ...plan, features: null });

      const limits = await service.getPlanLimits(tenantId);

      expect(limits.features).toEqual({});
    });
  });

  describe('checkOutletLimit', () => {
    beforeEach(() => {
      subscriptions.getCurrent.mockResolvedValue({ id: 'sub-1', tenantId, planId });
      prisma.subscriptionPlan.findUnique.mockResolvedValue(plan);
    });

    it('allows adding another outlet when under the limit', async () => {
      prisma.outlet.count.mockResolvedValue(2);

      const check = await service.checkOutletLimit(tenantId);

      expect(prisma.outlet.count).toHaveBeenCalledWith({ where: { tenantId, status: 'ACTIVE' } });
      expect(check).toEqual({ resource: 'outlets', allowed: true, current: 2, limit: 3, remaining: 1 });
    });

    it('disallows adding another outlet once at the limit', async () => {
      prisma.outlet.count.mockResolvedValue(3);

      const check = await service.checkOutletLimit(tenantId);

      expect(check).toEqual({ resource: 'outlets', allowed: false, current: 3, limit: 3, remaining: 0 });
    });

    it('disallows when already over the limit (e.g. after a plan downgrade)', async () => {
      prisma.outlet.count.mockResolvedValue(5);

      const check = await service.checkOutletLimit(tenantId);

      expect(check.allowed).toBe(false);
      expect(check.remaining).toBe(0); // clamped, not negative
    });

    it('treats a limit of 0 as unlimited', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue({ ...plan, maxOutlets: 0 });
      prisma.outlet.count.mockResolvedValue(999);

      const check = await service.checkOutletLimit(tenantId);

      expect(check.allowed).toBe(true);
      expect(check.remaining).toBe(Infinity);
    });
  });

  describe('checkUserLimit', () => {
    it('counts only ACTIVE users against the limit', async () => {
      subscriptions.getCurrent.mockResolvedValue({ id: 'sub-1', tenantId, planId });
      prisma.subscriptionPlan.findUnique.mockResolvedValue(plan);
      prisma.user.count.mockResolvedValue(4);

      const check = await service.checkUserLimit(tenantId);

      expect(prisma.user.count).toHaveBeenCalledWith({ where: { tenantId, status: 'ACTIVE' } });
      expect(check).toEqual({ resource: 'users', allowed: true, current: 4, limit: 10, remaining: 6 });
    });
  });

  describe('checkPosDeviceLimit', () => {
    it('counts distinct device ids from POS session history', async () => {
      subscriptions.getCurrent.mockResolvedValue({ id: 'sub-1', tenantId, planId });
      prisma.subscriptionPlan.findUnique.mockResolvedValue(plan);
      prisma.posSession.findMany.mockResolvedValue([{ deviceId: 'dev-1' }, { deviceId: 'dev-2' }]);

      const check = await service.checkPosDeviceLimit(tenantId);

      expect(prisma.posSession.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        distinct: ['deviceId'],
        select: { deviceId: true },
      });
      expect(check).toEqual({ resource: 'posDevices', allowed: true, current: 2, limit: 5, remaining: 3 });
    });
  });

  describe('isFeatureEnabled', () => {
    beforeEach(() => {
      subscriptions.getCurrent.mockResolvedValue({ id: 'sub-1', tenantId, planId });
      prisma.subscriptionPlan.findUnique.mockResolvedValue(plan);
    });

    it('returns true for a feature explicitly enabled on the plan', async () => {
      await expect(service.isFeatureEnabled(tenantId, 'whatsapp')).resolves.toBe(true);
    });

    it('returns false for a feature explicitly disabled on the plan', async () => {
      await expect(service.isFeatureEnabled(tenantId, 'reports')).resolves.toBe(false);
    });

    it('returns false for a feature key the plan does not mention, rather than defaulting to on', async () => {
      await expect(service.isFeatureEnabled(tenantId, 'some-new-feature')).resolves.toBe(false);
    });
  });

  describe('getUsageSummary', () => {
    it('bundles all three resource checks and the feature map together', async () => {
      subscriptions.getCurrent.mockResolvedValue({ id: 'sub-1', tenantId, planId });
      prisma.subscriptionPlan.findUnique.mockResolvedValue(plan);
      prisma.outlet.count.mockResolvedValue(1);
      prisma.user.count.mockResolvedValue(2);
      prisma.posSession.findMany.mockResolvedValue([{ deviceId: 'dev-1' }]);

      const summary = await service.getUsageSummary(tenantId);

      expect(summary.outlets).toEqual({ resource: 'outlets', allowed: true, current: 1, limit: 3, remaining: 2 });
      expect(summary.users).toEqual({ resource: 'users', allowed: true, current: 2, limit: 10, remaining: 8 });
      expect(summary.posDevices).toEqual({ resource: 'posDevices', allowed: true, current: 1, limit: 5, remaining: 4 });
      expect(summary.features).toEqual({ whatsapp: true, reports: false });
    });
  });
});
