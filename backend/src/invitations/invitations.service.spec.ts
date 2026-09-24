import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InvitationsService } from './invitations.service';

describe('InvitationsService', () => {
  let prisma: any;
  let audit: { log: jest.Mock };
  let auth: { login: jest.Mock };
  let entitlements: { checkUserLimit: jest.Mock };
  let service: InvitationsService;

  const tenantId = 'tenant-1';
  const inviterUserId = 'owner-1';

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      invitation: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      role: {
        findMany: jest.fn(),
      },
      outlet: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };
    audit = { log: jest.fn() };
    auth = { login: jest.fn().mockResolvedValue({ accessToken: 'signed-token' }) };
    entitlements = { checkUserLimit: jest.fn().mockResolvedValue(undefined) };
    service = new InvitationsService(prisma, audit as any, auth as any, entitlements as any);
  });

  describe('create', () => {
    const dto = {
      email: 'cashier@acme.com',
      firstName: 'Jane',
      lastName: 'Smith',
      roleIds: ['role-cashier'],
    };

    it('throws BadRequest when no roleIds are given', async () => {
      await expect(
        service.create(tenantId, inviterUserId, { ...dto, roleIds: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws Conflict when the email is already an active user in this tenant', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(service.create(tenantId, inviterUserId, dto)).rejects.toThrow(ConflictException);
    });

    it('throws Conflict when a PENDING invitation already exists for the email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.invitation.findFirst.mockResolvedValue({ id: 'inv-existing', status: 'PENDING' });

      await expect(service.create(tenantId, inviterUserId, dto)).rejects.toThrow(ConflictException);
    });

    it('throws BadRequest when a roleId does not belong to this tenant', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.invitation.findFirst.mockResolvedValue(null);
      prisma.role.findMany.mockResolvedValue([]); // none matched

      await expect(service.create(tenantId, inviterUserId, dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequest when an outletId does not belong to this tenant', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.invitation.findFirst.mockResolvedValue(null);
      prisma.role.findMany.mockResolvedValue([{ id: 'role-cashier' }]);
      prisma.outlet.findMany.mockResolvedValue([]); // none matched

      await expect(
        service.create(tenantId, inviterUserId, { ...dto, outletIds: ['outlet-bad'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('falls back to the default outlet when no outletIds are given', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.invitation.findFirst.mockResolvedValue(null);
      prisma.role.findMany.mockResolvedValue([{ id: 'role-cashier' }]);
      prisma.outlet.findFirst.mockResolvedValue({ id: 'outlet-main' });
      prisma.invitation.create.mockResolvedValue({
        id: 'inv-1',
        tenantId,
        email: dto.email,
        tokenHash: 'hash',
        status: 'PENDING',
      });

      const result = await service.create(tenantId, inviterUserId, dto);

      expect(prisma.invitation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ outletIds: ['outlet-main'] }),
        }),
      );
      expect(result.token).toEqual(expect.any(String));
      expect(result.token.length).toBeGreaterThan(32);
      expect((result.invitation as any).tokenHash).toBeUndefined();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entityType: 'Invitation' }),
      );
    });

    it('validates explicitly provided outletIds against this tenant', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.invitation.findFirst.mockResolvedValue(null);
      prisma.role.findMany.mockResolvedValue([{ id: 'role-cashier' }]);
      prisma.outlet.findMany.mockResolvedValue([{ id: 'outlet-jb' }]);
      prisma.invitation.create.mockResolvedValue({ id: 'inv-1', tenantId, tokenHash: 'hash' });

      await service.create(tenantId, inviterUserId, { ...dto, outletIds: ['outlet-jb'] });

      expect(prisma.outlet.findFirst).not.toHaveBeenCalled();
      expect(prisma.invitation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ outletIds: ['outlet-jb'] }) }),
      );
    });
  });

  describe('revoke', () => {
    it('throws NotFound when the invitation does not belong to this tenant', async () => {
      prisma.invitation.findFirst.mockResolvedValue(null);

      await expect(service.revoke(tenantId, 'inv-1', inviterUserId)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequest when the invitation is not PENDING', async () => {
      prisma.invitation.findFirst.mockResolvedValue({ id: 'inv-1', status: 'ACCEPTED' });

      await expect(service.revoke(tenantId, 'inv-1', inviterUserId)).rejects.toThrow(BadRequestException);
    });

    it('marks a pending invitation REVOKED and audits it', async () => {
      prisma.invitation.findFirst.mockResolvedValue({ id: 'inv-1', status: 'PENDING' });
      prisma.invitation.update.mockResolvedValue({ id: 'inv-1', status: 'REVOKED', tokenHash: 'hash' });

      const result = await service.revoke(tenantId, 'inv-1', inviterUserId);

      expect(result.status).toBe('REVOKED');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE', entityType: 'Invitation', entityId: 'inv-1' }),
      );
    });
  });

  describe('preview / accept token handling', () => {
    it('preview throws NotFound for an unknown token', async () => {
      prisma.invitation.findUnique.mockResolvedValue(null);

      await expect(service.preview('bogus-token')).rejects.toThrow(NotFoundException);
    });

    it('preview throws BadRequest and flips status to EXPIRED for a past-due PENDING invitation', async () => {
      prisma.invitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 1000),
        tenant: { name: 'Acme' },
      });
      prisma.invitation.update.mockResolvedValue({});

      await expect(service.preview('expired-token')).rejects.toThrow(BadRequestException);
      expect(prisma.invitation.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { status: 'EXPIRED' },
      });
    });

    it('preview throws BadRequest for an already-accepted invitation', async () => {
      prisma.invitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'ACCEPTED',
        expiresAt: new Date(Date.now() + 100000),
        tenant: { name: 'Acme' },
      });

      await expect(service.preview('used-token')).rejects.toThrow(BadRequestException);
    });

    it('preview returns safe fields for a valid pending invitation', async () => {
      prisma.invitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'PENDING',
        email: 'cashier@acme.com',
        firstName: 'Jane',
        lastName: 'Smith',
        expiresAt: new Date(Date.now() + 100000),
        tenant: { name: 'Acme Sdn Bhd' },
      });

      const result = await service.preview('good-token');

      expect(result).toEqual(
        expect.objectContaining({ email: 'cashier@acme.com', tenantName: 'Acme Sdn Bhd' }),
      );
    });

    it('accept creates the user with the invitation roles/outlets, marks it ACCEPTED, and logs in', async () => {
      prisma.invitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        tenantId,
        status: 'PENDING',
        email: 'cashier@acme.com',
        firstName: 'Jane',
        lastName: 'Smith',
        roleIds: ['role-cashier'],
        outletIds: ['outlet-main'],
        expiresAt: new Date(Date.now() + 100000),
        tenant: { name: 'Acme' },
      });
      const createdUser = {
        id: 'new-user',
        tenantId,
        email: 'cashier@acme.com',
        password: 'hashed',
        roles: [{ role: { name: 'cashier' } }],
      };
      prisma.user.create.mockResolvedValue(createdUser);
      prisma.invitation.update.mockResolvedValue({});

      const result = await service.accept('good-token', 'aStrongPassword123');

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId,
            email: 'cashier@acme.com',
            roles: { create: [{ roleId: 'role-cashier', tenantId }] },
            outlets: { create: [{ tenantId, outletId: 'outlet-main', isDefault: true }] },
          }),
        }),
      );
      expect(prisma.invitation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: expect.objectContaining({ status: 'ACCEPTED', acceptedUserId: 'new-user' }),
        }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entityType: 'User', tenantId }),
      );
      expect(auth.login).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-user' }));
      expect(result).toEqual({ accessToken: 'signed-token' });
    });

    it('accept never leaks the password field to auth.login', async () => {
      prisma.invitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        tenantId,
        status: 'PENDING',
        email: 'cashier@acme.com',
        firstName: 'Jane',
        lastName: 'Smith',
        roleIds: [],
        outletIds: [],
        expiresAt: new Date(Date.now() + 100000),
        tenant: { name: 'Acme' },
      });
      prisma.user.create.mockResolvedValue({
        id: 'new-user',
        password: 'hashed-secret',
        roles: [],
      });
      prisma.invitation.update.mockResolvedValue({});

      await service.accept('good-token', 'aStrongPassword123');

      const loggedInUser = auth.login.mock.calls[0][0];
      expect(loggedInUser.password).toBeUndefined();
    });
  });

  describe('list', () => {
    it('strips tokenHash from every returned invitation', async () => {
      prisma.invitation.findMany.mockResolvedValue([
        { id: 'inv-1', tokenHash: 'secret-1', status: 'PENDING' },
        { id: 'inv-2', tokenHash: 'secret-2', status: 'ACCEPTED' },
      ]);

      const result = await service.list(tenantId);

      expect(result).toHaveLength(2);
      expect(result.every((i: any) => i.tokenHash === undefined)).toBe(true);
    });
  });
});
