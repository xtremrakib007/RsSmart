import { PaymentsController } from './payments.controller';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';

describe('PaymentsController', () => {
  let checkouts: { createCheckout: jest.Mock; getCheckoutStatusForOwner: jest.Mock; handleBillplzWebhook: jest.Mock };
  let controller: PaymentsController;

  const tenantAUser = { userId: 'user-1', tenantId: 'tenant-a' };
  const tenantBUser = { userId: 'user-2', tenantId: 'tenant-b' };

  beforeEach(() => {
    checkouts = {
      createCheckout: jest.fn(),
      getCheckoutStatusForOwner: jest.fn(),
      handleBillplzWebhook: jest.fn(),
    };
    controller = new PaymentsController(checkouts as any);
  });

  describe('createCheckout', () => {
    it("scopes checkout creation to the caller's own tenant from the JWT, never the request body", async () => {
      const dto = { subscriptionId: 'sub-a', successUrl: 'https://x/success', cancelUrl: 'https://x/cancel' };

      await controller.createCheckout(tenantAUser, dto as any);

      expect(checkouts.createCheckout).toHaveBeenCalledWith('tenant-a', 'user-1', 'sub-a', dto.successUrl, dto.cancelUrl);
    });

    it("requires SUBSCRIPTION_MANAGE permission", () => {
      const permissions = Reflect.getMetadata(PERMISSIONS_KEY, PaymentsController.prototype.createCheckout);
      expect(permissions).toEqual([Permission.SUBSCRIPTION_MANAGE]);
    });
  });

  describe('checkoutStatus', () => {
    it("scopes the lookup to the caller's own tenant", async () => {
      await controller.checkoutStatus(tenantAUser, 'bill_abc');
      expect(checkouts.getCheckoutStatusForOwner).toHaveBeenCalledWith('tenant-a', 'bill_abc');
    });

    it("a different caller's lookup never carries the previous caller's tenant", async () => {
      await controller.checkoutStatus(tenantBUser, 'bill_xyz');
      expect(checkouts.getCheckoutStatusForOwner).toHaveBeenCalledWith('tenant-b', 'bill_xyz');
      expect(checkouts.getCheckoutStatusForOwner).not.toHaveBeenCalledWith('tenant-a', expect.anything());
    });
  });

  describe('billplzWebhook', () => {
    it('is marked @Public — Billplz has no user JWT to send', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, PaymentsController.prototype.billplzWebhook);
      expect(isPublic).toBe(true);
    });

    it('passes the raw body straight through for signature verification inside the service', async () => {
      const body = { id: 'bill_abc', x_signature: 'sig' };
      await controller.billplzWebhook(body as any);
      expect(checkouts.handleBillplzWebhook).toHaveBeenCalledWith(body);
    });
  });

  describe('redirectLanding', () => {
    it('is marked @Public and never calls the checkout service at all', async () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, PaymentsController.prototype.redirectLanding);
      expect(isPublic).toBe(true);

      controller.redirectLanding({ 'billplz[id]': 'bill_abc' });

      expect(checkouts.createCheckout).not.toHaveBeenCalled();
      expect(checkouts.getCheckoutStatusForOwner).not.toHaveBeenCalled();
      expect(checkouts.handleBillplzWebhook).not.toHaveBeenCalled();
    });
  });
});
