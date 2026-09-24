import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let prisma: any;
  let audit: { log: jest.Mock };
  let service: UsersService;

  const tenantId = 'tenant-1';
  const baseUser = {
    id: 'user-1',
    tenantId,
    status: 'ACTIVE',
    roles: [{ role: { name: 'cashier' } }],
    outlets: [],
  };

  beforeEach(() => {
    prisma = {
      user: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      role: { findMany: jest.fn() },
      userRole: { deleteMany: jest.fn(), createMany: jest.fn() },
      $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
    };
    audit = { log: jest.fn() };
    service = new UsersService(prisma, audit as any);
  });

  describe('disable', () => {
    it('refuses to let a user disable their own account', async () => {
      prisma.user.findFirst.mockResolvedValue(baseUser);

      await expect(service.disable('user-1', tenantId, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('sets status INACTIVE and bumps tokenVersion so any live JWT is immediately rejected', async () => {
      prisma.user.findFirst.mockResolvedValue(baseUser);
      prisma.user.update.mockResolvedValue({ id: 'user-1', status: 'INACTIVE' });

      await service.disable('user-1', tenantId, 'actor-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { status: 'INACTIVE', tokenVersion: { increment: 1 } },
      });
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE', entityType: 'User' }));
    });
  });

  describe('assignRoles', () => {
    it('rejects a roleId that does not belong to the caller tenant', async () => {
      prisma.user.findFirst.mockResolvedValue(baseUser);
      prisma.role.findMany.mockResolvedValue([]); // none matched

      await expect(
        service.assignRoles('user-1', tenantId, 'actor-1', ['role-from-elsewhere']),
      ).rejects.toThrow(BadRequestException);
    });

    it('replaces role rows and bumps tokenVersion so the permission change is effective immediately', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce(baseUser) // inside assignRoles' initial findOne
        .mockResolvedValueOnce({ ...baseUser, roles: [{ role: { name: 'manager' } }] }); // final findOne to return
      prisma.role.findMany.mockResolvedValue([{ id: 'role-manager', tenantId, name: 'manager' }]);

      await service.assignRoles('user-1', tenantId, 'actor-1', ['role-manager']);

      expect(prisma.$transaction).toHaveBeenCalled();
      const txOps = prisma.$transaction.mock.calls[0][0];
      expect(txOps).toHaveLength(3); // deleteMany, createMany, tokenVersion bump
    });
  });
});
