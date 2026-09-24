import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: JwtService;
  let audit: { log: jest.Mock };
  let subscriptions: { createTrial: jest.Mock };

  const tenantId = 'tenant-1';
  const baseUser = {
    id: 'user-1',
    tenantId,
    email: 'test@example.com',
    password: 'hashed-password',
    status: 'ACTIVE',
    firstName: 'Test',
    lastName: 'User',
    tokenVersion: 0,
    roles: [{ role: { name: 'ADMIN' } }],
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      tenant: {
        create: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      outlet: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      role: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      subscriptionPlan: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    audit = { log: jest.fn() };
    subscriptions = { createTrial: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: SubscriptionsService, useValue: subscriptions },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('signed-token'),
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('validateUser', () => {
    it('throws Unauthorized when no user matches the tenant/email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.validateUser('nobody@example.com', 'pw', tenantId),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized when the account is not ACTIVE', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, status: 'SUSPENDED' });

      await expect(
        service.validateUser(baseUser.email, 'anything', tenantId),
      ).rejects.toThrow('Account is not active');
    });

    it('throws Unauthorized when the password does not match', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(
        service.validateUser(baseUser.email, 'wrong-password', tenantId),
      ).rejects.toThrow('Invalid credentials');
    });

    it('returns the user without the password field on success', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const result = await service.validateUser(baseUser.email, 'correct-password', tenantId);

      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe(baseUser.email);
    });
  });

  describe('login', () => {
    it('issues access and refresh tokens, embeds tokenVersion, and records lastLoginAt', async () => {
      prisma.user.update.mockResolvedValue(undefined);

      const result = await service.login(baseUser);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: baseUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ tokenVersion: baseUser.tokenVersion }),
      );
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
      expect(result.user).not.toHaveProperty('password');
      expect(result.user.roles).toEqual(['ADMIN']);
    });
  });

  describe('refreshToken', () => {
    it('throws Unauthorized when the token fails verification', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('bad token');
      });

      await expect(service.refreshToken('garbage')).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized when the user no longer exists or is inactive', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: baseUser.id, tokenVersion: 0 });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken('valid-shape-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws Unauthorized when the token was issued before a session-revoking change', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: baseUser.id, tokenVersion: 0 });
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, tokenVersion: 1 });

      await expect(service.refreshToken('stale-token')).rejects.toThrow(UnauthorizedException);
    });

    it('re-issues tokens for a valid refresh token', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: baseUser.id, tokenVersion: 0 });
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.user.update.mockResolvedValue(undefined);

      const result = await service.refreshToken('valid-token');

      expect(result.accessToken).toBe('signed-token');
    });
  });

  describe('registerCompany', () => {
    const createdTenant = { id: 'new-tenant', name: 'Acme Sdn Bhd', slug: 'acme-sdn-bhd' };
    const createdOutlet = { id: 'outlet-1', tenantId: 'new-tenant', isDefault: true };
    const ownerRole = { id: 'role-owner' };
    const createdOwner = {
      ...baseUser,
      id: 'owner-1',
      tenantId: 'new-tenant',
      roles: [{ role: { name: 'owner' } }],
    };
    const registerPayload = {
      companyName: 'Acme Sdn Bhd',
      email: 'owner@acme.com',
      password: 'password123',
      firstName: 'Owner',
      lastName: 'Person',
    };

    beforeEach(() => {
      prisma.$transaction.mockImplementation(async (cb: any) =>
        cb({
          tenant: { create: jest.fn().mockResolvedValue(createdTenant) },
          outlet: { create: jest.fn().mockResolvedValue(createdOutlet) },
          role: { create: jest.fn().mockResolvedValue(ownerRole) },
          user: { create: jest.fn().mockResolvedValue(createdOwner) },
        }),
      );
      prisma.user.update.mockResolvedValue(undefined);
    });

    it('creates a brand new tenant, default outlet, system roles, and an owner — never joining an existing tenant', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-starter', slug: 'starter' });
      subscriptions.createTrial.mockResolvedValue({ id: 'sub-1', status: 'TRIALING' });

      const result = await service.registerCompany(registerPayload);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'new-tenant', action: 'CREATE', entityType: 'Tenant' }),
      );
      expect(result.accessToken).toBe('signed-token');
    });

    it('starts a trial subscription on the configured default plan for the new tenant/owner', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-starter', slug: 'starter' });
      subscriptions.createTrial.mockResolvedValue({ id: 'sub-1', status: 'TRIALING' });

      await service.registerCompany(registerPayload);

      expect(prisma.subscriptionPlan.findUnique).toHaveBeenCalledWith({
        where: { slug: expect.any(String) },
      });
      expect(subscriptions.createTrial).toHaveBeenCalledWith('new-tenant', 'plan-starter', 'owner-1');
    });

    it('still returns a successful signup if the configured trial plan slug matches nothing, and audits the failure', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue(null);

      const result = await service.registerCompany(registerPayload);

      expect(subscriptions.createTrial).not.toHaveBeenCalled();
      expect(result.accessToken).toBe('signed-token'); // signup itself must not fail
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'new-tenant',
          action: 'SUBSCRIPTION_TRIAL_START_FAILED',
          newValues: expect.objectContaining({ reason: expect.stringContaining('matched no active plan') }),
        }),
      );
    });

    it('still returns a successful signup if createTrial itself throws, and audits the failure', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-starter', slug: 'starter' });
      subscriptions.createTrial.mockRejectedValue(new Error('db unreachable'));

      const result = await service.registerCompany(registerPayload);

      expect(result.accessToken).toBe('signed-token'); // signup itself must not fail
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'new-tenant',
          action: 'SUBSCRIPTION_TRIAL_START_FAILED',
          newValues: expect.objectContaining({ reason: 'db unreachable' }),
        }),
      );
    });
  });

  describe('inviteUser', () => {
    it('rejects when the email is already registered for the tenant', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);

      await expect(
        service.inviteUser(tenantId, {
          email: baseUser.email,
          password: 'pw12345678',
          firstName: 'A',
          lastName: 'B',
          roleIds: ['role-1'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when a roleId does not belong to the calling tenant', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findMany.mockResolvedValue([]); // none matched

      await expect(
        service.inviteUser(tenantId, {
          email: 'new@example.com',
          password: 'pw12345678',
          firstName: 'A',
          lastName: 'B',
          roleIds: ['role-from-another-tenant'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates the user scoped to the CALLER tenant, ignoring any other tenantId', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findMany.mockResolvedValue([{ id: 'role-1', tenantId }]);
      prisma.outlet.findFirst.mockResolvedValue({ id: 'outlet-1' });
      prisma.user.create.mockResolvedValue({ ...baseUser, roles: [], outlets: [] });

      await service.inviteUser(tenantId, {
        email: 'new@example.com',
        password: 'plaintext-pw',
        firstName: 'A',
        lastName: 'B',
        roleIds: ['role-1'],
      });

      const createArgs = prisma.user.create.mock.calls[0][0];
      expect(createArgs.data.tenantId).toBe(tenantId);
      expect(createArgs.data.password).not.toBe('plaintext-pw');
    });
  });
});
