import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OutletGuard } from './outlet.guard';

function makeContext(request: any) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

describe('OutletGuard', () => {
  let prisma: any;
  let guard: OutletGuard;

  const tenantId = 'tenant-1';
  const outletA = { id: 'outlet-a', tenantId, status: 'ACTIVE' };
  const outletB = { id: 'outlet-b', tenantId, status: 'ACTIVE' };
  const otherTenantOutlet = { id: 'outlet-x', tenantId: 'tenant-2', status: 'ACTIVE' };

  beforeEach(() => {
    prisma = {
      userOutlet: { findFirst: jest.fn(), findUnique: jest.fn() },
      outlet: { findFirst: jest.fn() },
    };
    guard = new OutletGuard(prisma);
  });

  it('lets an unauthenticated request through (JwtAuthGuard is responsible for rejecting it)', async () => {
    const request: any = {};
    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
  });

  it('rejects when no outlet is specified and the user has no default outlet', async () => {
    prisma.userOutlet.findFirst.mockResolvedValue(null);
    const request: any = { user: { userId: 'u1', tenantId, scopeAllOutlets: false }, headers: {}, params: {}, query: {}, body: {} };

    await expect(guard.canActivate(makeContext(request))).rejects.toThrow(BadRequestException);
  });

  it('falls back to the user default outlet when none is specified', async () => {
    prisma.userOutlet.findFirst.mockResolvedValue({ outletId: outletA.id, isDefault: true });
    prisma.outlet.findFirst.mockResolvedValue(outletA);
    prisma.userOutlet.findUnique.mockResolvedValue({ userId: 'u1', outletId: outletA.id });
    const request: any = { user: { userId: 'u1', tenantId, scopeAllOutlets: false }, headers: {}, params: {}, query: {}, body: {} };

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(request.outlet).toEqual(outletA);
  });

  it('rejects an outlet that belongs to a different tenant (tenant isolation)', async () => {
    prisma.outlet.findFirst.mockResolvedValue(null); // findFirst is itself scoped by tenantId in the guard's where clause
    const request: any = {
      user: { userId: 'u1', tenantId, scopeAllOutlets: true },
      headers: { 'x-outlet-id': otherTenantOutlet.id },
      params: {},
      query: {},
      body: {},
    };

    await expect(guard.canActivate(makeContext(request))).rejects.toThrow(ForbiddenException);
    expect(prisma.outlet.findFirst).toHaveBeenCalledWith({ where: { id: otherTenantOutlet.id, tenantId } });
  });

  it('rejects a same-tenant outlet the user is not assigned to (outlet isolation for non-scopeAllOutlets roles)', async () => {
    prisma.outlet.findFirst.mockResolvedValue(outletB);
    prisma.userOutlet.findUnique.mockResolvedValue(null); // no assignment to outlet B
    const request: any = {
      user: { userId: 'cashier-1', tenantId, scopeAllOutlets: false },
      headers: { 'x-outlet-id': outletB.id },
      params: {},
      query: {},
      body: {},
    };

    await expect(guard.canActivate(makeContext(request))).rejects.toThrow(ForbiddenException);
  });

  it('allows a scopeAllOutlets user (owner/admin) onto any outlet in their tenant without an explicit assignment', async () => {
    prisma.outlet.findFirst.mockResolvedValue(outletB);
    const request: any = {
      user: { userId: 'admin-1', tenantId, scopeAllOutlets: true },
      headers: { 'x-outlet-id': outletB.id },
      params: {},
      query: {},
      body: {},
    };

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(prisma.userOutlet.findUnique).not.toHaveBeenCalled();
    expect(request.outlet).toEqual(outletB);
  });

  it('rejects an inactive outlet', async () => {
    prisma.outlet.findFirst.mockResolvedValue({ ...outletB, status: 'INACTIVE' });
    const request: any = {
      user: { userId: 'admin-1', tenantId, scopeAllOutlets: true },
      headers: { 'x-outlet-id': outletB.id },
      params: {},
      query: {},
      body: {},
    };

    await expect(guard.canActivate(makeContext(request))).rejects.toThrow(ForbiddenException);
  });
});
