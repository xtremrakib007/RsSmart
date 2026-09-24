import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

// Sandbox-typing workaround — same reason as SubscriptionsService's and
// SubscriptionCheckoutService's local types (see those files' comments):
// no live Prisma client generated in this sandbox (no network access to
// binaries.prisma.sh), so '@prisma/client' has no model types yet.
type CheckoutStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';

interface CheckoutWithPlan {
  id: string;
  tenantId: string;
  subscriptionId: string;
  planId: string;
  provider: string;
  providerReference: string;
  status: CheckoutStatus;
  amount: unknown;
  currency: string;
  webhookProcessedAt: Date | null;
  createdAt: Date;
  subscription: { plan: { name: string; slug: string } } | null;
}

interface SubscriptionWithPlan {
  id: string;
  planId: string;
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt: Date | null;
  suspendedAt: Date | null;
  createdAt: Date;
  plan: { name: string; slug: string; priceMonthly: unknown; currency: string };
}

// Hard ceiling on the ?limit= query param — a customer's own billing
// history is unbounded in principle (retries, years of renewals), but this
// endpoint is a read for a human to look at, not a bulk export, so an
// unbounded or absurdly large `take` isn't something to accept from a
// client-supplied query param.
const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;

function clampLimit(limit?: number): number {
  if (!limit || Number.isNaN(limit) || limit <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(limit, MAX_PAGE_SIZE);
}

/**
 * Phase 22 — Billing History. Deliberately read-only and deliberately thin:
 * this reuses data Phase 14/15/21 already persist (SubscriptionCheckout rows
 * as payment attempts, Subscription rows as renewal/plan-change history)
 * rather than introducing a new Invoice/Payment ledger of its own. Per the
 * roadmap's "do not build an accounting system" — there is no tax
 * calculation, no line-item breakdown, no PDF generation here. A
 * "SUCCEEDED" checkout already has everything a Malaysian FPX/DuitNow
 * payer needs (Billplz itself emits a receipt); this service exists to let
 * the tenant see that history inside the app, tenant-scoped, without
 * needing DB access.
 */
@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Payment history — every checkout attempt for the tenant (not just
   * successful ones), most recent first. Includes PENDING/FAILED/CANCELLED
   * rows deliberately: a customer looking at "what happened when I tried to
   * pay" needs to see a failed attempt, not just the one that eventually
   * succeeded.
   */
  async listPayments(tenantId: string, limit?: number) {
    const checkouts: CheckoutWithPlan[] = await this.prisma.subscriptionCheckout.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: clampLimit(limit),
      include: { subscription: { include: { plan: { select: { name: true, slug: true } } } } },
    });

    return checkouts.map((checkout) => ({
      id: checkout.id,
      provider: checkout.provider,
      providerReference: checkout.providerReference,
      status: checkout.status,
      amount: checkout.amount,
      currency: checkout.currency,
      planName: checkout.subscription?.plan?.name ?? null,
      subscriptionId: checkout.subscriptionId,
      createdAt: checkout.createdAt,
      paidAt: checkout.status === 'SUCCEEDED' ? checkout.webhookProcessedAt : null,
    }));
  }

  /**
   * Invoice-like records. Deliberately synthesized from SUCCEEDED checkouts
   * rather than a separate persisted Invoice table — see this class's file
   * comment. `invoiceNumber` is derived deterministically from the checkout
   * row (year/month + short id), not a separately-tracked sequence, so
   * there is nothing here that needs its own counter or migration.
   */
  async listInvoices(tenantId: string, limit?: number) {
    const checkouts: CheckoutWithPlan[] = await this.prisma.subscriptionCheckout.findMany({
      where: { tenantId, status: 'SUCCEEDED' },
      orderBy: { createdAt: 'desc' },
      take: clampLimit(limit),
      include: { subscription: { include: { plan: { select: { name: true, slug: true } } } } },
    });

    return checkouts.map((checkout) => ({
      invoiceNumber: this.buildInvoiceNumber(checkout),
      subscriptionId: checkout.subscriptionId,
      planName: checkout.subscription?.plan?.name ?? null,
      amount: checkout.amount,
      currency: checkout.currency,
      provider: checkout.provider,
      providerReference: checkout.providerReference,
      issuedAt: checkout.webhookProcessedAt ?? checkout.createdAt,
    }));
  }

  /**
   * Subscription/renewal history — every Subscription row the tenant has
   * ever had, most recent first. Because Phase 15 deliberately never
   * mutates a Subscription's identity across a plan change (a new trial,
   * upgrade, or renewal is its own row — see SubscriptionsService's file
   * comment), this list already *is* the renewal history; nothing new to
   * compute.
   */
  async listSubscriptionHistory(tenantId: string, limit?: number) {
    const subscriptions: SubscriptionWithPlan[] = await this.prisma.subscription.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: clampLimit(limit),
      include: { plan: { select: { name: true, slug: true, priceMonthly: true, currency: true } } },
    });

    return subscriptions.map((subscription) => ({
      id: subscription.id,
      planName: subscription.plan?.name ?? null,
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      cancelledAt: subscription.cancelledAt,
      suspendedAt: subscription.suspendedAt,
      createdAt: subscription.createdAt,
    }));
  }

  private buildInvoiceNumber(checkout: { createdAt: Date; id: string }): string {
    const year = checkout.createdAt.getUTCFullYear();
    const month = String(checkout.createdAt.getUTCMonth() + 1).padStart(2, '0');
    const shortId = checkout.id.replace(/-/g, '').slice(0, 8).toUpperCase();
    return `INV-${year}${month}-${shortId}`;
  }
}
