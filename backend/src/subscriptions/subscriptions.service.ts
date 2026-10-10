import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

// Mirrors the `SubscriptionStatus` enum in schema.prisma. Kept as a local
// string-literal type rather than imported from '@prisma/client' because
// this sandbox has no network access to binaries.prisma.sh, so
// `prisma generate` can't run here and the generated client has no model
// types yet (see PHASE14-SUBSCRIPTION-MODELS.md). Swap this for
// `import { SubscriptionStatus } from '@prisma/client'` once `prisma
// generate` has actually been run against this schema — the string values
// are identical, this is purely about what's typeable in this sandbox.
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';

interface SubscriptionRecord {
  id: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt: Date | null;
  suspendedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Same sandbox-typing workaround as SubscriptionRecord above. `priceMonthly`
// is a Prisma `Decimal` at the schema level; typed `unknown` here rather than
// guessing at the runtime Decimal shape without a generated client to check
// against — callers that need to do math with it should convert explicitly
// once real generated types are available.
interface SubscriptionPlanRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceMonthly: unknown;
  currency: string;
  maxOutlets: number;
  maxUsers: number;
  maxPosDevices: number;
  features: unknown;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// Statuses a tenant can be sitting in while still "live" — i.e. they already
// have a subscription in flight and shouldn't be handed a second trial or a
// second concurrent subscription. Terminal statuses (CANCELLED, EXPIRED) are
// deliberately excluded: a tenant whose subscription ended is free to start
// a new one.
const LIVE_STATUSES: SubscriptionStatus[] = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED'];

const DEFAULT_TRIAL_DAYS = 14;

@Injectable()
export class SubscriptionsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /**
   * Returns the tenant's most recent subscription (by createdAt), or null if
   * the tenant has never had one. "Most recent" — not "most recent live one"
   * — because callers like getCurrent() need to distinguish "never
   * subscribed" from "subscription ended", and both createTrial()'s guard
   * and getStatus() need the true latest row regardless of its status.
   */
  private async findLatest(tenantId: string): Promise<SubscriptionRecord | null> {
    return this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Bare lookup — no active/retired check. Throws only if the id doesn't resolve at all. */
  private async getPlanById(planId: string): Promise<SubscriptionPlanRecord> {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Subscription plan not found');
    return plan;
  }

  /**
   * Use when a tenant is about to be PUT ONTO this plan (new trial,
   * upgrade/downgrade) — refuses a retired plan on top of the bare
   * existence check. Do not reuse this for "what plan is this tenant
   * already on" (see getCurrentPlan) — a tenant validly stays on a plan
   * that's since been retired from new sign-ups, and should still be able
   * to see it.
   */
  private async getPlanOrThrow(planId: string): Promise<SubscriptionPlanRecord> {
    const plan = await this.getPlanById(planId);
    if (!plan.isActive) throw new BadRequestException('This subscription plan is no longer available');
    return plan;
  }

  /**
   * Loads a subscription scoped to the tenant (never trusts a bare
   * subscriptionId — a cross-tenant id must resolve to "not found", not
   * "found but belongs to someone else").
   */
  private async getOwned(tenantId: string, subscriptionId: string): Promise<SubscriptionRecord> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, tenantId },
    });
    if (!subscription) throw new NotFoundException('Subscription not found');
    return subscription;
  }

  /**
   * Get the tenant's current subscription. "Current" = the most recent row;
   * callers that only want a live one should check `status` themselves or
   * use isActive()/getStatus() below.
   */
  async getCurrent(tenantId: string): Promise<SubscriptionRecord> {
    const subscription = await this.findLatest(tenantId);
    if (!subscription) throw new NotFoundException('This company has no subscription yet');
    return subscription;
  }

  /**
   * The full plan record backing the tenant's current subscription (not
   * just its limits — name, price, description, etc). Reuses getCurrent()
   * for "which subscription is current". Deliberately uses getPlanById(),
   * NOT getPlanOrThrow() — a tenant can validly be sitting on a plan
   * that's since been retired from new sign-ups (isActive: false), and
   * must still be able to see their own current plan; only *starting* a
   * subscription on a retired plan is refused (see createTrial).
   */
  async getCurrentPlan(tenantId: string): Promise<SubscriptionPlanRecord> {
    const subscription = await this.getCurrent(tenantId);
    return this.getPlanById(subscription.planId);
  }

  /**
   * The public plan catalog — active, purchasable plans only, in display
   * order. Not tenant-scoped: plans are a global catalog, not per-tenant
   * data, so there's nothing here to leak across companies. Left behind
   * the standard auth guard (any authenticated user, any tenant, can list
   * plans) rather than made `@Public()` — if a pre-signup/unauthenticated
   * pricing page needs this (Phase 18 onboarding might), that's a
   * deliberate call to make then, not assumed here.
   */
  async listAvailablePlans(): Promise<SubscriptionPlanRecord[]> {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Start a trial for a tenant that doesn't already have a live one. Each
   * call creates a new row rather than mutating an existing one, so a
   * tenant's subscription history (trial → active → cancelled → new trial,
   * etc.) is preserved.
   */
  async createTrial(
    tenantId: string,
    planId: string,
    actorUserId: string,
    trialDays: number = DEFAULT_TRIAL_DAYS,
  ): Promise<SubscriptionRecord> {
    if (trialDays <= 0) throw new BadRequestException('trialDays must be positive');

    const existing = await this.findLatest(tenantId);
    if (existing && LIVE_STATUSES.includes(existing.status)) {
      throw new ConflictException('This company already has an active or trialing subscription');
    }

    const plan = await this.getPlanOrThrow(planId);

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    const subscription = await this.prisma.subscription.create({
      data: {
        tenantId,
        planId: plan.id,
        status: 'TRIALING',
        trialEndsAt,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'SUBSCRIPTION_TRIAL_STARTED',
      entityType: 'Subscription',
      entityId: subscription.id,
      newValues: { planId: plan.id, trialEndsAt },
    });

    return subscription;
  }

  /**
   * Move a subscription into ACTIVE — e.g. converting a trial after
   * checkout, or resuming after PAST_DUE/SUSPENDED. This method only flips
   * the status/period fields; it does not talk to a payment provider
   * (Phase 20/21) and must never be reachable from an unverified client
   * signal (see roadmap Phase 21: "a browser success redirect must not
   * activate a subscription").
   */
  async activate(
    tenantId: string,
    subscriptionId: string,
    actorUserId: string,
    periodEnd?: Date,
  ): Promise<SubscriptionRecord> {
    const subscription = await this.getOwned(tenantId, subscriptionId);
    if (subscription.status === 'ACTIVE') return subscription; // already active — idempotent no-op
    this.assertTransition(subscription.status, 'ACTIVE');

    const now = new Date();
    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd ?? subscription.currentPeriodEnd ?? undefined,
        cancelAtPeriodEnd: false,
        suspendedAt: null,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'SUBSCRIPTION_ACTIVATED',
      entityType: 'Subscription',
      entityId: subscription.id,
      oldValues: { status: subscription.status },
      newValues: { status: 'ACTIVE' },
    });

    return updated;
  }

  /**
   * Cancel a subscription. Defaults to `atPeriodEnd: true` — the tenant
   * keeps access until currentPeriodEnd and the status only flips to
   * CANCELLED once that period elapses (via expire(), a scheduled job in a
   * later phase). Pass `atPeriodEnd: false` for an immediate cancellation.
   */
  async cancel(
    tenantId: string,
    subscriptionId: string,
    actorUserId: string,
    options: { atPeriodEnd?: boolean } = {},
  ): Promise<SubscriptionRecord> {
    const atPeriodEnd = options.atPeriodEnd ?? true;
    const subscription = await this.getOwned(tenantId, subscriptionId);

    if (!atPeriodEnd && subscription.status === 'CANCELLED') return subscription; // already cancelled — idempotent no-op

    if (atPeriodEnd) {
      // Not a status transition yet — just flags intent. Status still needs
      // to allow reaching CANCELLED eventually, so reuse the same guard.
      this.assertTransition(subscription.status, 'CANCELLED');
      const updated = await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { cancelAtPeriodEnd: true },
      });
      await this.audit.log({
        tenantId,
        userId: actorUserId,
        action: 'SUBSCRIPTION_CANCEL_SCHEDULED',
        entityType: 'Subscription',
        entityId: subscription.id,
        newValues: { cancelAtPeriodEnd: true },
      });
      return updated;
    }

    this.assertTransition(subscription.status, 'CANCELLED');
    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelAtPeriodEnd: false },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'SUBSCRIPTION_CANCELLED',
      entityType: 'Subscription',
      entityId: subscription.id,
      oldValues: { status: subscription.status },
      newValues: { status: 'CANCELLED' },
    });

    return updated;
  }

  /**
   * Suspend a subscription — e.g. a failed-payment grace period expiring, or
   * a manual admin action. Only reachable from ACTIVE/PAST_DUE.
   */
  async suspend(tenantId: string, subscriptionId: string, actorUserId: string, reason?: string): Promise<SubscriptionRecord> {
    const subscription = await this.getOwned(tenantId, subscriptionId);
    if (subscription.status === 'SUSPENDED') return subscription; // already suspended — idempotent no-op
    this.assertTransition(subscription.status, 'SUSPENDED');

    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'SUSPENDED', suspendedAt: new Date() },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'SUBSCRIPTION_SUSPENDED',
      entityType: 'Subscription',
      entityId: subscription.id,
      oldValues: { status: subscription.status },
      newValues: { status: 'SUSPENDED', reason },
    });

    return updated;
  }

  /**
   * Mark a subscription EXPIRED — a terminal state distinct from CANCELLED:
   * the tenant didn't choose to leave, their period/trial simply ran out
   * without renewal. Intended to be driven by a scheduled job in a later
   * phase, not directly by end-user action.
   */
  async expire(tenantId: string, subscriptionId: string, actorUserId?: string): Promise<SubscriptionRecord> {
    const subscription = await this.getOwned(tenantId, subscriptionId);
    if (subscription.status === 'EXPIRED') return subscription; // already expired — idempotent no-op
    this.assertTransition(subscription.status, 'EXPIRED');

    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'EXPIRED' },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'SUBSCRIPTION_EXPIRED',
      entityType: 'Subscription',
      entityId: subscription.id,
      oldValues: { status: subscription.status },
      newValues: { status: 'EXPIRED' },
    });

    return updated;
  }

  /**
   * Basic status check — is this tenant currently entitled to use the
   * product? TRIALING and ACTIVE both count as "in good standing"; a
   * trial/period whose end date has already passed does not, even if the
   * status column hasn't been flipped to EXPIRED yet by the (future) sweep
   * job, so this is safe to call from request-time authorization.
   */
  async isActive(tenantId: string): Promise<boolean> {
    const subscription = await this.findLatest(tenantId);
    if (!subscription) return false;
    if (subscription.status !== 'TRIALING' && subscription.status !== 'ACTIVE') return false;

    const periodEnd = subscription.currentPeriodEnd ?? subscription.trialEndsAt;
    if (periodEnd && periodEnd.getTime() < Date.now()) return false;

    return true;
  }

  async getStatus(tenantId: string): Promise<SubscriptionStatus | 'NONE'> {
    const subscription = await this.findLatest(tenantId);
    return subscription?.status ?? 'NONE';
  }

  /**
   * Allowed status transitions. Kept as an explicit map rather than scattered
   * `if` checks so the lifecycle is easy to audit in one place — anything not
   * listed here is refused with a clear error instead of silently mutating
   * an inconsistent state.
   */
  private static readonly TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
    TRIALING: ['ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED'],
    ACTIVE: ['PAST_DUE', 'SUSPENDED', 'CANCELLED', 'EXPIRED'],
    PAST_DUE: ['ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED'],
    SUSPENDED: ['ACTIVE', 'CANCELLED', 'EXPIRED'],
    CANCELLED: [],
    EXPIRED: [],
  };

  private assertTransition(from: SubscriptionStatus, to: SubscriptionStatus) {
    const allowed = SubscriptionsService.TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(`Cannot move subscription from ${from} to ${to}`);
    }
  }
}
