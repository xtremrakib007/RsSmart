import { BillingController } from './billing.controller';

describe('BillingController', () => {
  let billing: { listPayments: jest.Mock; listInvoices: jest.Mock; listSubscriptionHistory: jest.Mock };
  let controller: BillingController;

  const tenantAUser = { userId: 'user-1', tenantId: 'tenant-a', permissions: [] };
  const tenantBUser = { userId: 'user-2', tenantId: 'tenant-b', permissions: [] };

  beforeEach(() => {
    billing = {
      listPayments: jest.fn(),
      listInvoices: jest.fn(),
      listSubscriptionHistory: jest.fn(),
    };
    controller = new BillingController(billing as any);
  });

  describe('listPayments', () => {
    it("scopes the lookup to the caller's own tenant from the JWT", async () => {
      billing.listPayments.mockResolvedValue([]);

      await controller.listPayments(tenantAUser);

      expect(billing.listPayments).toHaveBeenCalledWith('tenant-a', undefined);
    });

    it('a different caller gets scoped to their own tenant, never the previous caller\'s', async () => {
      billing.listPayments.mockResolvedValue([]);

      await controller.listPayments(tenantBUser);

      expect(billing.listPayments).toHaveBeenCalledWith('tenant-b', undefined);
      expect(billing.listPayments).not.toHaveBeenCalledWith('tenant-a', undefined);
    });

    it('parses a string ?limit= query param into a number before passing it down', async () => {
      billing.listPayments.mockResolvedValue([]);

      await controller.listPayments(tenantAUser, '25');

      expect(billing.listPayments).toHaveBeenCalledWith('tenant-a', 25);
    });
  });

  describe('listInvoices', () => {
    it("scopes the lookup to the caller's own tenant from the JWT", async () => {
      billing.listInvoices.mockResolvedValue([]);

      await controller.listInvoices(tenantAUser);

      expect(billing.listInvoices).toHaveBeenCalledWith('tenant-a', undefined);
    });
  });

  describe('listSubscriptionHistory', () => {
    it("scopes the lookup to the caller's own tenant from the JWT", async () => {
      billing.listSubscriptionHistory.mockResolvedValue([]);

      await controller.listSubscriptionHistory(tenantAUser);

      expect(billing.listSubscriptionHistory).toHaveBeenCalledWith('tenant-a', undefined);
    });

    it('parses a string ?limit= query param into a number before passing it down', async () => {
      billing.listSubscriptionHistory.mockResolvedValue([]);

      await controller.listSubscriptionHistory(tenantAUser, '10');

      expect(billing.listSubscriptionHistory).toHaveBeenCalledWith('tenant-a', 10);
    });
  });
});
