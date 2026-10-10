import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService tenant-scoped mutations', () => {
  let prisma: any;
  let audit: { log: jest.Mock };
  let service: UsersService;
  let tx: any;

  const tenantId = 'tenant-1';
  const baseUser = {
    id: 'user-1',
    tenantId,
    status: 'ACTIVE',
    roles: [{ role: { name: 'cashier' } }],
    outlets: [],
  };

  beforeEach(() => {
    tx = {
      user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      userRole: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }), createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    prisma = {
      user: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      role: { findMany: jest.fn() },
      userRole: { deleteMany: jest.fn(), createMany: jest.fn() },
      $transaction: jest.fn(async (work: any) => typeof work === 'function' ? work(tx) : Promise.all(work)),
    };
    audit = { log: jest.fn() };
    service = new UsersService(prisma, audit as any);
  });

  describe('update', () => {
    it('updates only a user in the requested tenant', async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findFirst.mockResolvedValue(baseUser);

      await service.update('user-1', tenantId, { firstName: 'Updated' });

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1', tenantId },
        data: { firstName: 'Updated' },
      });
    });

    it('does not return another tenant user when no scoped row matches', async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.update('foreign-user', tenantId, { firstName: 'Updated' })).rejects.toThrow(NotFoundException);
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('disable', () => {
    it('refuses to let a user disable their own account', async () => {
      prisma.user.findFirst.mockResolvedValue(baseUser);
      await expect(service.disable('user-1', tenantId, 'user-1')).rejects.toThrow(BadRequestException);
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('atomically scopes deactivation to tenant and bumps tokenVersion', async () => {
      prisma.user.findFirst.mockResolvedValue(baseUser);

      await service.disable('user-1', tenantId, 'actor-1');

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1', tenantId },
        data: { status: 'INACTIVE', tokenVersion: { increment: 1 } },
      });
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE', entityType: 'User' }));
    });

    it('rejects a foreign-tenant or missing user when the atomic update matches nothing', async () => {
      prisma.user.findFirst.mockResolvedValue(baseUser);
      prisma.user.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.disable('user-1', tenantId, 'actor-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('enable', () => {
    it('scopes activation to tenant', async () => {
      prisma.user.findFirst.mockResolvedValue({ ...baseUser, status: 'INACTIVE' });
      await service.enable('user-1', tenantId, 'actor-1');
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1', tenantId },
        data: { status: 'ACTIVE' },
      });
    });
  });

  describe('assignRoles', () => {
    it('rejects a roleId that does not belong to the caller tenant', async () => {
      prisma.user.findFirst.mockResolvedValue(baseUser);
      prisma.role.findMany.mockResolvedValue([]);

      await expect(service.assignRoles('user-1', tenantId, 'actor-1', ['role-from-elsewhere'])).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('updates user token version and replaces only tenant-scoped role rows in one transaction', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce(baseUser)
        .mockResolvedValueOnce({ ...baseUser, roles: [{ role: { name: 'manager' } }] });
      prisma.role.findMany.mockResolvedValue([{ id: 'role-manager', tenantId, name: 'manager' }]);

      await service.assignRoles('user-1', tenantId, 'actor-1', ['role-manager']);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1', tenantId },
        data: { tokenVersion: { increment: 1 } },
      });
      expect(tx.userRole.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1', tenantId } });
      expect(tx.userRole.createMany).toHaveBeenCalledWith({
        data: [{ userId: 'user-1', roleId: 'role-manager', tenantId }],
      });
    });

    it('rolls back role replacement if the tenant-scoped user update matches nothing', async () => {
      prisma.user.findFirst.mockResolvedValue(baseUser);
      prisma.role.findMany.mockResolvedValue([{ id: 'role-manager', tenantId, name: 'manager' }]);
      tx.user.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.assignRoles('user-1', tenantId, 'actor-1', ['role-manager'])).rejects.toThrow(NotFoundException);
      expect(tx.userRole.deleteMany).not.toHaveBeenCalled();
      expect(tx.userRole.createMany).not.toHaveBeenCalled();
    });
  });
});
