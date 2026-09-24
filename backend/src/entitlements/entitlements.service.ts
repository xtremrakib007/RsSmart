import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

export interface PlanLimits {
  maxOutlets: number;
  maxUsers: number;
  maxPosDevices: number;
  features: Record<string, boolean>;
}

export type EntitlementResource = 'outlets' | 'users' | 'posDevices';

export interface LimitCheck {
  resource: EntitlementResource;
  /** True if the tenant can add ONE MORE unit of this resource right now. */
  allowed: boolean;
  current: number;
  limit: number;
  /** Infinity when the plan places no ceiling on this resource. */
  remaining: number;
}

/**
 * Centralizes "is this tenant within its plan limits" / "does this tenant's
 * plan include feature X" checks, reading from `SubscriptionPlan` via the
 * tenant's current `Subscription` (see `SubscriptionsService`).
 *
 * Per the Phase 16 roadmap entry this is a read-only, reusable checking
 * service only — nothing here blocks a create/invite/registration flow yet.
 * Wiring these checks into outlet creation, user invitation, and POS device
 * registration so they actually stop an over-limit action is Phase 23
 * (Subscription Enforcement), a deliberate product decision (e.g. what a
 * blocked create should return to the client) left for that phase.
 */
@Injectable()
export class EntitlementsService {
  constructor(
    private prisma: PrismaService,
    private subscriptions: SubscriptionsService,
  ) {}

  /**
   * Plan limits currently on file for a tenant, from its most recent
   * subscription's plan. Reuses `SubscriptionsService.getCurrent()` rather
   * than re-querying "which subscription counts as current" here, so that
   * stays defined in exactly one place.
   *
   * Deliberately does NOT gate on subscription status (TRIALING/ACTIVE/
   * PAST_DUE/SUSPENDED/...) — a tenant with a lapsed subscription still has
   * a plan on file, and a caller may want its limits for display purposes
   * (e.g. "you're over your old plan's limit"). Callers that need to know
   * whether the tenant is actually entitled to use the product right now
   * should check `SubscriptionsService.isActive()` themselves; that's a
   * separate question from "what does their plan say".
   */
  async getPlanLimits(tenantId: string): Promise<PlanLimits> {
    const subscription = await this.subscriptions.getCurrent(tenantId);
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: subscription.planId } });
    if (!plan) {
      // Shouldn't happen — Subscription.planId has an onDelete: Restrict FK
      // to SubscriptionPlan — but a caller must never read a missing plan
      // as "no limits". Fail loudly instead.
      throw new NotFoundException('Subscription plan not found');
    }
    return {
      maxOutlets: plan.maxOutlets,
      maxUsers: plan.maxUsers,
      maxPosDevices: plan.maxPosDevices,
      features: (plan.features ?? {}) as Record<string, boolean>,
    };
  }

  /** Active outlets counted against the plan's outlet limit. */
  private countOutlets(tenantId: string): Promise<number> {
    return this.prisma.outlet.count({ where: { tenantId, status: 'ACTIVE' } });
  }

  /** Active users counted against the plan's user limit. */
  private countUsers(tenantId: string): Promise<number> {
    return this.prisma.user.count({ where: { tenantId, status: 'ACTIVE' } });
  }

  /**
   * POS devices counted against the plan's device limit.
   *
   * There is no device-registry table (no `PosDevice` model) yet, so this
   * counts distinct `PosSession.deviceId` values ever seen for the tenant —
   * the best available proxy for "how many physical POS terminals this
   * tenant operates". Known limitation, flagged rather than silently baked
   * in (same spirit as the open items the Phase 13 audit left for later):
   * a tenant that retires a device keeps counting it forever (its deviceId
   * never leaves session history), and a newly provisioned device that
   * hasn't opened a session yet doesn't count at all. Revisit this method
   * if/when a real device-registration flow exists (would likely land
   * around Phase 25, POS Idempotency, or Phase 18 onboarding).
   */
  private async countPosDevices(tenantId: string): Promise<number> {
    const rows = await this.prisma.posSession.findMany({
      where: { tenantId },
      distinct: ['deviceId'],
      select: { deviceId: true },
    });
    return rows.length;
  }

  /** limit <= 0 means the plan places no ceiling on that resource. */
  private toCheck(resource: EntitlementResource, current: number, limit: number): LimitCheck {
    const unlimited = limit <= 0;
    return {
      resource,
      allowed: unlimited || current < limit,
      current,
      limit,
      remaining: unlimited ? Infinity : Math.max(0, limit - current),
    };
  }

  async checkOutletLimit(tenantId: string): Promise<LimitCheck> {
    const { maxOutlets } = await this.getPlanLimits(tenantId);
    const current = await this.countOutlets(tenantId);
    return this.toCheck('outlets', current, maxOutlets);
  }

  async checkUserLimit(tenantId: string): Promise<LimitCheck> {
    const { maxUsers } = await this.getPlanLimits(tenantId);
    const current = await this.countUsers(tenantId);
    return this.toCheck('users', current, maxUsers);
  }

  async checkPosDeviceLimit(tenantId: string): Promise<LimitCheck> {
    const { maxPosDevices } = await this.getPlanLimits(tenantId);
    const current = await this.countPosDevices(tenantId);
    return this.toCheck('posDevices', current, maxPosDevices);
  }

  /**
   * Whether a named feature flag is on for the tenant's plan. An unknown or
   * unlisted feature key defaults to `false` — a plan must opt a feature in
   * explicitly, so a typo'd or newly-introduced feature key never silently
   * grants access to every existing plan.
   */
  async isFeatureEnabled(tenantId: string, featureKey: string): Promise<boolean> {
    const { features } = await this.getPlanLimits(tenantId);
    return features[featureKey] === true;
  }

  /**
   * All three resource checks plus the feature map in one call — the shape
   * Phase 17's "plan limits" API is expected to expose.
   */
  async getUsageSummary(tenantId: string): Promise<{
    outlets: LimitCheck;
    users: LimitCheck;
    posDevices: LimitCheck;
    features: Record<string, boolean>;
  }> {
    const limits = await this.getPlanLimits(tenantId);
    const [outletsUsed, usersUsed, posDevicesUsed] = await Promise.all([
      this.countOutlets(tenantId),
      this.countUsers(tenantId),
      this.countPosDevices(tenantId),
    ]);
    return {
      outlets: this.toCheck('outlets', outletsUsed, limits.maxOutlets),
      users: this.toCheck('users', usersUsed, limits.maxUsers),
      posDevices: this.toCheck('posDevices', posDevicesUsed, limits.maxPosDevices),
      features: limits.features,
    };
  }
}
