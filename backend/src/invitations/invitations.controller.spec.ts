import { InvitationsController } from './invitations.controller';

describe('InvitationsController', () => {
  let invitations: { create: jest.Mock; list: jest.Mock; revoke: jest.Mock; preview: jest.Mock; accept: jest.Mock };
  let controller: InvitationsController;

  const tenantAUser = { userId: 'user-1', tenantId: 'tenant-a', permissions: ['users.manage'] };
  const tenantBUser = { userId: 'user-2', tenantId: 'tenant-b', permissions: ['users.manage'] };

  beforeEach(() => {
    invitations = {
      create: jest.fn(),
      list: jest.fn(),
      revoke: jest.fn(),
      preview: jest.fn(),
      accept: jest.fn(),
    };
    controller = new InvitationsController(invitations as any);
  });

  describe('create', () => {
    it("scopes the invitation to the caller's own tenant from the JWT, never the request body", async () => {
      const dto = { email: 'a@b.com', firstName: 'A', lastName: 'B', roleIds: ['role-1'] };

      await controller.create(tenantAUser, dto as any);

      expect(invitations.create).toHaveBeenCalledWith('tenant-a', 'user-1', dto);
    });

    it('a different caller creates the invitation under their own tenant, never the previous one', async () => {
      const dto = { email: 'c@d.com', firstName: 'C', lastName: 'D', roleIds: ['role-2'] };

      await controller.create(tenantBUser, dto as any);

      expect(invitations.create).toHaveBeenCalledWith('tenant-b', 'user-2', dto);
      expect(invitations.create).not.toHaveBeenCalledWith('tenant-a', expect.anything(), expect.anything());
    });
  });

  describe('list', () => {
    it("lists only the caller's own tenant's invitations", async () => {
      await controller.list(tenantAUser);

      expect(invitations.list).toHaveBeenCalledWith('tenant-a');
    });
  });

  describe('revoke', () => {
    it("scopes revocation to the caller's own tenant — cannot revoke another tenant's invitation by id alone", async () => {
      await controller.revoke('inv-1', tenantAUser);

      expect(invitations.revoke).toHaveBeenCalledWith('tenant-a', 'inv-1', 'user-1');
    });
  });

  describe('preview / accept', () => {
    it('preview takes only the token — no tenant/session context at all (public route)', async () => {
      await controller.preview('raw-token');

      expect(invitations.preview).toHaveBeenCalledWith('raw-token');
    });

    it('accept takes only the token/password from the body — no tenant/session context (public route)', async () => {
      const dto = { token: 'raw-token', password: 'aStrongPassword123' };

      await controller.accept(dto as any);

      expect(invitations.accept).toHaveBeenCalledWith('raw-token', 'aStrongPassword123');
    });
  });
});
