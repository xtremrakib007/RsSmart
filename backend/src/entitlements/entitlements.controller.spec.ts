import { EntitlementsController } from './entitlements.controller';

describe('EntitlementsController', () => {
  let entitlements: { getUsageSummary: jest.Mock };
  let controller: EntitlementsController;

  const tenantAUser = { userId: 'user-1', tenantId: 'tenant-a', permissions: [] };
  const tenantBUser = { userId: 'user-2', tenantId: 'tenant-b', permissions: [] };

  beforeEach(() => {
    entitlements = { getUsageSummary: jest.fn() };
    controller = new EntitlementsController(entitlements as any);
  });

  describe('getLimits', () => {
    it("scopes usage/limits to the caller's own tenant from the JWT", async () => {
      entitlements.getUsageSummary.mockResolvedValue({ outlets: {}, users: {}, posDevices: {}, features: {} });

      await controller.getLimits(tenantAUser);

      expect(entitlements.getUsageSummary).toHaveBeenCalledWith('tenant-a');
    });

    it('a different caller gets scoped to their own tenant, never the previous caller\'s', async () => {
      entitlements.getUsageSummary.mockResolvedValue({ outlets: {}, users: {}, posDevices: {}, features: {} });

      await controller.getLimits(tenantBUser);

      expect(entitlements.getUsageSummary).toHaveBeenCalledWith('tenant-b');
      expect(entitlements.getUsageSummary).not.toHaveBeenCalledWith('tenant-a');
    });
  });
});
