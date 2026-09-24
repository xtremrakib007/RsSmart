import { SubscriptionsController } from './subscriptions.controller';

describe('SubscriptionsController', () => {
  let subscriptions: { getCurrent: jest.Mock; getCurrentPlan: jest.Mock; listAvailablePlans: jest.Mock };
  let controller: SubscriptionsController;

  const tenantAUser = { userId: 'user-1', tenantId: 'tenant-a', permissions: [] };
  const tenantBUser = { userId: 'user-2', tenantId: 'tenant-b', permissions: [] };

  beforeEach(() => {
    subscriptions = {
      getCurrent: jest.fn(),
      getCurrentPlan: jest.fn(),
      listAvailablePlans: jest.fn(),
    };
    controller = new SubscriptionsController(subscriptions as any);
  });

  describe('getCurrent', () => {
    it("scopes the lookup to the caller's own tenant from the JWT", async () => {
      subscriptions.getCurrent.mockResolvedValue({ id: 'sub-a', tenantId: 'tenant-a' });

      await controller.getCurrent(tenantAUser);

      expect(subscriptions.getCurrent).toHaveBeenCalledWith('tenant-a');
    });

    it('a different caller gets scoped to their own tenant, never the previous caller\'s', async () => {
      subscriptions.getCurrent.mockResolvedValue({ id: 'sub-b', tenantId: 'tenant-b' });

      await controller.getCurrent(tenantBUser);

      expect(subscriptions.getCurrent).toHaveBeenCalledWith('tenant-b');
      expect(subscriptions.getCurrent).not.toHaveBeenCalledWith('tenant-a');
    });
  });

  describe('getCurrentPlan', () => {
    it("scopes the lookup to the caller's own tenant from the JWT", async () => {
      subscriptions.getCurrentPlan.mockResolvedValue({ id: 'plan-1' });

      await controller.getCurrentPlan(tenantAUser);

      expect(subscriptions.getCurrentPlan).toHaveBeenCalledWith('tenant-a');
    });
  });

  describe('listPlans', () => {
    it('takes no tenant argument — the plan catalog is global, not per-company data', async () => {
      subscriptions.listAvailablePlans.mockResolvedValue([{ id: 'plan-1' }]);

      await controller.listPlans();

      expect(subscriptions.listAvailablePlans).toHaveBeenCalledWith();
    });
  });
});
