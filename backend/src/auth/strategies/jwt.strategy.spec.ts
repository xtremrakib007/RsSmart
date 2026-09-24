import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let prisma: any;
  let strategy: JwtStrategy;

  const dbUser = {
    id: 'user-1',
    tenantId: 'tenant-1',
    status: 'ACTIVE',
    tokenVersion: 3,
    roles: [
      { role: { name: 'manager', permissions: ['products.read', 'inventory.adjust'], scopeAllOutlets: false } },
    ],
    outlets: [{ outletId: 'outlet-a', isDefault: true }],
  };

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    prisma = { user: { findUnique: jest.fn() } };
    strategy = new JwtStrategy(prisma);
  });

  it('rejects when the user no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(strategy.validate({ sub: 'user-1', tokenVersion: 3 })).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when the user is not ACTIVE', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...dbUser, status: 'INACTIVE' });
    await expect(strategy.validate({ sub: 'user-1', tokenVersion: 3 })).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a JWT whose tokenVersion is stale (session was revoked since it was issued)', async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser); // dbUser.tokenVersion === 3
    await expect(strategy.validate({ sub: 'user-1', tokenVersion: 2 })).rejects.toThrow(
      'Session has been invalidated, please log in again',
    );
  });

  it('derives roles/permissions from the DB, not the signed payload, so a role change takes effect immediately', async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser);
    // A payload from a token signed before this user's roles changed — it
    // used to carry stale roles (e.g. ['admin']); the strategy must ignore
    // that and use whatever the DB says right now.
    const result = await strategy.validate({ sub: 'user-1', tokenVersion: 3, roles: ['admin'] });

    expect(result.roles).toEqual(['manager']);
    expect(result.permissions).toEqual(['products.read', 'inventory.adjust']);
    expect(result.scopeAllOutlets).toBe(false);
    expect(result.outletIds).toEqual(['outlet-a']);
  });

  it('treats a wildcard permission as scopeAllOutlets=true even if no role explicitly set the flag', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...dbUser,
      roles: [{ role: { name: 'owner', permissions: ['*'], scopeAllOutlets: true } }],
    });
    const result = await strategy.validate({ sub: 'user-1', tokenVersion: 3 });
    expect(result.scopeAllOutlets).toBe(true);
    expect(result.permissions).toEqual(['*']);
  });
});
