import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { RolesGuard } from './roles.guard';
import { Permission } from '../permissions/permission.enum';

function makeContext(request: any) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

describe('PermissionsGuard', () => {
  it('allows a public route through with no user at all', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValueOnce(true) } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(makeContext({}))).toBe(true);
  });

  it('allows through when the route has no @RequirePermissions', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(undefined),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(makeContext({ user: { permissions: [] } }))).toBe(true);
  });

  it('denies a user missing the required permission', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce([Permission.USERS_MANAGE]),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const request = { user: { permissions: [Permission.SALES_CREATE] } };
    expect(() => guard.canActivate(makeContext(request))).toThrow(ForbiddenException);
  });

  it('allows a user with the exact required permission', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce([Permission.USERS_MANAGE]),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const request = { user: { permissions: [Permission.USERS_MANAGE] } };
    expect(guard.canActivate(makeContext(request))).toBe(true);
  });

  it('allows a wildcard (owner) role regardless of the specific permission required', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce([Permission.OUTLETS_MANAGE]),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const request = { user: { permissions: ['*'] } };
    expect(guard.canActivate(makeContext(request))).toBe(true);
  });
});

describe('RolesGuard', () => {
  it('is a no-op (allows through) when nothing requires roles — this used to be the state of ALL routes, since the guard was never registered', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext({ user: { roles: [] } }))).toBe(true);
  });

  it('denies a user without one of the required roles', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(['admin', 'manager']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const request = { user: { roles: ['cashier'] } };
    expect(guard.canActivate(makeContext(request))).toBe(false);
  });

  it('allows a user with one of the required roles', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(['admin', 'manager']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const request = { user: { roles: ['manager'] } };
    expect(guard.canActivate(makeContext(request))).toBe(true);
  });

  it('does not throw when there is no user on the request (public route) and roles are required — returns false rather than crashing', () => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => (key === 'isPublic' ? false : ['admin'])),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(makeContext({}))).not.toThrow();
    expect(guard.canActivate(makeContext({}))).toBe(false);
  });
});
