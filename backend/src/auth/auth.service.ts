import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DEFAULT_ROLES } from '../common/permissions/default-roles';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { PlanLimitExceededException } from '../common/exceptions/plan-limit.exception';
import { getRequiredSignupPolicies } from '../legal-policies/policy-registry';

// The plan every self-service signup is trialed onto. A slug (stable,
// human-assigned in the seed data), not a raw plan id — ids are
// per-database UUIDs that differ across dev/staging/production, so a
// hardcoded id would silently point at the wrong row (or nothing) the
// moment this runs against a different database than whichever one it
// was copied from. Deliberately NOT client-suppliable (see
// RegisterCompanyDto) — which plan a brand-new, unpaid signup lands on
// is an operator decision, not something a signup request gets to pick
// for itself.
const DEFAULT_TRIAL_PLAN_SLUG = process.env.DEFAULT_TRIAL_PLAN_SLUG || 'starter';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private audit: AuditService,
    private subscriptions: SubscriptionsService,
    private entitlements: EntitlementsService,
  ) {}

  async validateUser(email: string, password: string, tenantId: string) {
    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
      include: { roles: { include: { role: true } } },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    const { password: _, ...result } = user;
    return result;
  }

  async login(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      // Embedded so JwtStrategy can detect a role/permission change or a
      // forced logout (see UsersService.setActive / assignRoles) and reject
      // the token immediately rather than trusting it until expiry.
      tokenVersion: user.tokenVersion,
    };

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      }),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tenantId: user.tenantId,
        roles: user.roles?.map((r: any) => r.role.name) ?? [],
      },
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { roles: { include: { role: true } } },
      });
      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedException('User not found or inactive');
      }
      if (payload.tokenVersion !== user.tokenVersion) {
        throw new UnauthorizedException('Session has been invalidated, please log in again');
      }
      return this.login(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Public, unauthenticated self-service signup. Creates a BRAND NEW company
   * (tenant), its default outlet, the four system roles, and the caller as
   * that company's owner. This replaces the old public `register` endpoint,
   * which accepted a client-supplied `tenantId` and `roleIds` and let anyone
   * join an arbitrary existing tenant with an arbitrary role — the Phase 12
   * "do not trust client-supplied tenantId or roleIds" finding. Nothing here
   * is taken from the client except the new company's own name and the
   * owner's own credentials.
   */
  async registerCompany(data: {
    companyName: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    acceptedPolicyKeys: string[];
  }) {
    const requiredPolicies = getRequiredSignupPolicies();
    const submittedKeys = new Set(data.acceptedPolicyKeys || []);
    const missingPolicies = requiredPolicies.filter((policy) => !submittedKeys.has(policy.key));
    const unknownKeys = [...submittedKeys].filter((key) => !requiredPolicies.some((policy) => policy.key === key));
    if (missingPolicies.length || unknownKeys.length) {
      throw new BadRequestException({
        message: 'You must accept every current required policy to register a company',
        missingPolicyKeys: missingPolicies.map((policy) => policy.key),
        unknownPolicyKeys: unknownKeys,
      });
    }
    const slug = await this.generateUniqueSlug(data.companyName);
    const hashedPassword = await bcrypt.hash(data.password, 12);

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: data.companyName, slug, status: 'TRIAL' },
      });

      const outlet = await tx.outlet.create({
        data: {
          tenantId: tenant.id,
          code: 'MAIN',
          name: `${data.companyName} - Main Outlet`,
          isDefault: true,
        },
      });

      const createdRoles: Record<string, { id: string }> = {};
      for (const def of DEFAULT_ROLES) {
        createdRoles[def.name] = await tx.role.create({
          data: {
            tenantId: tenant.id,
            name: def.name,
            description: def.description,
            isSystem: def.isSystem,
            scopeAllOutlets: def.scopeAllOutlets,
            permissions: def.permissions,
          },
        });
      }

      const owner = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: data.email,
          password: hashedPassword,
          firstName: data.firstName,
          lastName: data.lastName,
          roles: { create: [{ roleId: createdRoles['owner'].id }] },
          outlets: { create: [{ tenantId: tenant.id, outletId: outlet.id, isDefault: true }] },
        },
        include: { roles: { include: { role: true } } },
      });

      await tx.policyAcceptance.createMany({
        data: requiredPolicies.map((policy) => ({
          tenantId: tenant.id,
          userId: owner.id,
          policyKey: policy.key,
          policyTitle: policy.title,
          policyVersion: policy.version,
          contentHash: policy.contentHash,
          action: 'ACCEPTED',
          flow: 'COMPANY_REGISTRATION',
        })),
      });

      return { tenant, outlet, owner };
    });

    await this.audit.log({
      tenantId: result.tenant.id,
      userId: result.owner.id,
      action: 'CREATE',
      entityType: 'Tenant',
      entityId: result.tenant.id,
      newValues: { name: result.tenant.name, slug: result.tenant.slug },
    });

    // Deliberately OUTSIDE the transaction above, not inside it:
    // SubscriptionsService.createTrial() owns its own prisma.create() and
    // audit.log() calls and isn't written to accept a transaction client, and
    // giving it one here would mean changing Phase 15's already-shipped,
    // already-tested service just to serve this one call site — out of
    // scope for "smallest change required for this phase." The tradeoff:
    // this is two round trips, not one atomic one, so it's possible (if
    // rare — see the catch below) for a company to exist for a moment
    // without a trial row. That's judged acceptable because nothing reads
    // subscription status to gate access yet (Phase 23 is what will), so a
    // brief or even lingering gap here doesn't lock the new owner out of
    // anything today.
    //
    // Failure here must NOT fail the signup response: the tenant, outlet,
    // roles and owner above are already committed and real, and this
    // service has no way to "undo" someone else's company. Swallow and log
    // loudly instead — findLatest()-backed methods on SubscriptionsService
    // (isActive/getCurrent/createTrial's own guard) all treat "no
    // subscription row" as a clean, well-defined state, so a tenant stuck
    // here is fully recoverable later: the very same createTrial() call
    // will succeed cleanly next time nothing live exists yet, whether that
    // retry comes from a future admin action, a scheduled sweep, or a
    // manual fix — none of which exist yet, and none of which this phase
    // is building.
    try {
      const plan = await this.prisma.subscriptionPlan.findUnique({
        where: { slug: DEFAULT_TRIAL_PLAN_SLUG },
      });
      if (!plan) {
        // Distinguished from a thrown/caught error below: this is a config
        // problem (the configured slug matches no seeded plan in THIS
        // database), not a transient failure, so it's worth a distinct
        // audit action to make that obvious to whoever investigates rather
        // than reading like a generic subscription-service outage.
        await this.audit.log({
          tenantId: result.tenant.id,
          userId: result.owner.id,
          action: 'SUBSCRIPTION_TRIAL_START_FAILED',
          entityType: 'Tenant',
          entityId: result.tenant.id,
          newValues: {
            reason: 'DEFAULT_TRIAL_PLAN_SLUG matched no active plan',
            slug: DEFAULT_TRIAL_PLAN_SLUG,
          },
        });
      } else {
        await this.subscriptions.createTrial(result.tenant.id, plan.id, result.owner.id);
      }
    } catch (err) {
      await this.audit.log({
        tenantId: result.tenant.id,
        userId: result.owner.id,
        action: 'SUBSCRIPTION_TRIAL_START_FAILED',
        entityType: 'Tenant',
        entityId: result.tenant.id,
        newValues: { reason: err instanceof Error ? err.message : 'unknown error' },
      });
    }

    const { password: _pw, ...owner } = result.owner;
    return this.login(owner);
  }

  /**
   * Authenticated invite flow: an existing user with `users.manage`
   * permission invites a new employee into THEIR OWN tenant. tenantId is
   * always taken from the caller's session (`inviterTenantId`), never from
   * the request body, and roleIds/outletIds are validated to actually belong
   * to that tenant before use — this is what closes the IDOR-style hole the
   * old open `register` endpoint had.
   */
  async inviteUser(
    inviterTenantId: string,
    data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      roleIds: string[];
      outletIds?: string[];
    },
  ) {
    // Phase 23 — enforce user limit
    const check = await this.entitlements.checkUserLimit(inviterTenantId);
    if (!check.allowed) {
      throw new PlanLimitExceededException('user', check.current, check.limit);
    }

    if (!data.roleIds?.length) {
      throw new BadRequestException('At least one roleId is required');
    }

    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: inviterTenantId, email: data.email } },
    });
    if (existing) throw new BadRequestException('Email already registered in this company');

    const roles = await this.prisma.role.findMany({
      where: { tenantId: inviterTenantId, id: { in: data.roleIds } },
    });
    if (roles.length !== data.roleIds.length) {
      throw new BadRequestException('One or more roleIds are invalid for this company');
    }

    let outlets: { id: string }[] = [];
    if (data.outletIds?.length) {
      outlets = await this.prisma.outlet.findMany({
        where: { tenantId: inviterTenantId, id: { in: data.outletIds } },
        select: { id: true },
      });
      if (outlets.length !== data.outletIds.length) {
        throw new BadRequestException('One or more outletIds are invalid for this company');
      }
    } else {
      const defaultOutlet = await this.prisma.outlet.findFirst({
        where: { tenantId: inviterTenantId, isDefault: true },
        select: { id: true },
      });
      if (defaultOutlet) outlets = [defaultOutlet];
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        tenantId: inviterTenantId,
        roles: { create: data.roleIds.map((roleId) => ({ roleId })) },
        outlets: {
          create: outlets.map((o, i) => ({
            tenantId: inviterTenantId,
            outletId: o.id,
            isDefault: i === 0,
          })),
        },
      },
      include: { roles: { include: { role: true } }, outlets: true },
    });

    const { password: _, ...result } = user;
    return result;
  }

  private async generateUniqueSlug(companyName: string): Promise<string> {
    const base = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'company';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = attempt === 0 ? base : `${base}-${randomUUID().slice(0, 6)}`;
      const existing = await this.prisma.tenant.findUnique({ where: { slug: candidate } });
      if (!existing) return candidate;
    }
    return `${base}-${randomUUID().slice(0, 8)}`;
  }
}
