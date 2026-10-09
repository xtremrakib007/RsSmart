import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { OutletsService } from './outlets.service';

describe('OutletsService', () => {
  let prisma: any;
  let audit: { log: jest.Mock };
  let service: OutletsService;

  const tenantId = 'tenant-1';

  beforeEach(() => {
    prisma = {
      outlet: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      user: { findFirst: jest.fn() },
      userOutlet: { findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn(), updateMany: jest.fn(), count: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    };
    audit = { log: jest.fn() };
    service = new OutletsService(prisma, audit as any);
  });

  describe('get / tenant isolation', () => {
    it('throws NotFound when the outlet belongs to a different tenant', async () => {
      // findFirst is always called scoped by tenantId, so a cross-tenant id resolves to null
      prisma.outlet.findFirst.mockResolvedValue(null);

      await expect(service.get(tenantId, 'outlet-from-another-company')).rejects.toThrow(NotFoundException);
      expect(prisma.outlet.findFirst).toHaveBeenCalledWith({ where: { id: 'outlet-from-another-company', tenantId } });
    });
  });

  describe('create', () => {
    it('rejects a duplicate outlet code within the same company', async () => {
      prisma.outlet.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create(tenantId, 'actor-1', { code: 'MAIN', name: 'Main' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates the outlet and writes an audit log entry', async () => {
      prisma.outlet.findUnique.mockResolvedValue(null);
      prisma.outlet.create.mockResolvedValue({ id: 'outlet-new', tenantId, code: 'JB-01', name: 'JB Branch' });

      const result = await service.create(tenantId, 'actor-1', { code: 'JB-01', name: 'JB Branch' });

      expect(result.code).toBe('JB-01');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId, action: 'CREATE', entityType: 'Outlet' }),
      );
    });
  });

  describe('update', () => {
    it('refuses to deactivate the default outlet', async () => {
      prisma.outlet.findFirst.mockResolvedValue({ id: 'outlet-a', tenantId, isDefault: true, status: 'ACTIVE' });

      await expect(
        service.update(tenantId, 'actor-1', 'outlet-a', { status: 'INACTIVE' as any }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('assignUser', () => {
    it('rejects assigning a user who belongs to a different tenant', async () => {
      prisma.outlet.findFirst.mockResolvedValue({ id: 'outlet-a', tenantId });
      prisma.user.findFirst.mockResolvedValue(null); // scoped by tenantId in the query

      await expect(
        service.assignUser(tenantId, 'actor-1', 'outlet-a', 'user-from-another-company'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({ where: { id: 'user-from-another-company', tenantId } });
    });

    it('clears any prior default before setting a new default outlet assignment', async () => {
      prisma.outlet.findFirst.mockResolvedValue({ id: 'outlet-b', tenantId });
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1', tenantId });
      prisma.userOutlet.upsert.mockResolvedValue({ id: 'assignment-1' });

      await service.assignUser(tenantId, 'actor-1', 'outlet-b', 'user-1', true);

      expect(prisma.userOutlet.updateMany).toHaveBeenCalledWith({
        where: { tenantId, userId: 'user-1', isDefault: true },
        data: { isDefault: false },
      });
    });
  });

  describe('unassignUser', () => {
    it("refuses to remove a user's last remaining outlet assignment", async () => {
      prisma.outlet.findFirst.mockResolvedValue({ id: 'outlet-a', tenantId });
      prisma.userOutlet.findUnique.mockResolvedValue({ id: 'assignment-1', tenantId, userId: 'user-1', outletId: 'outlet-a' });
      prisma.userOutlet.count.mockResolvedValue(1);

      await expect(service.unassignUser(tenantId, 'actor-1', 'outlet-a', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('allows removal when the user has other outlet assignments remaining', async () => {
      prisma.outlet.findFirst.mockResolvedValue({ id: 'outlet-a', tenantId });
      prisma.userOutlet.findUnique.mockResolvedValue({ id: 'assignment-1', tenantId, userId: 'user-1', outletId: 'outlet-a' });
      prisma.userOutlet.count.mockResolvedValue(2);
      prisma.userOutlet.delete.mockResolvedValue({});

      const result = await service.unassignUser(tenantId, 'actor-1', 'outlet-a', 'user-1');
      expect(result.success).toBe(true);
    });
  });
});
