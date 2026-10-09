import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PaymentsService } from './payments.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { verifyBillplzSignature } from './providers/billplz-signature.util';

// Sandbox-typing workaround — same reason as SubscriptionsService's local
// types (see that file's comment): no live Prisma client generated here.
interface CheckoutRecord {
  id: string;
  tenantId: string;
  subscriptionId: string;
  planId: string;
  provider: string;
  providerReference: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  amount: unknown;
  currency: string;
  checkoutUrl: string;
  webhookProcessedAt: Date | null;
  webhookProcessingAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Audit log entries need a userId; webhook-driven mutations have no human
// actor. Kept as a distinct, greppable sentinel rather than null/undefined
// so audit history clearly shows "the system did this because a payment
// provider told it to", not "some user we forgot to record".
const SYSTEM_ACTOR = 'system:billplz-webhook';

/**
 * Ties PaymentsService (Phase 20's provider-agnostic adapter) and
 * SubscriptionsService (Phase 15's lifecycle) together with the local
 * persistence Phase 20 deferred (see PHASE20 doc). This is the ONLY place
 * a webhook is allowed to call SubscriptionsService.activate() — nothing
 * driven by a browser redirect ever calls into this service's webhook
 * path (see PaymentsController: the redirect-facing endpoint only reads
 * status, it never calls handleBillplzWebhook()).
 */
@Injectable()
export class SubscriptionCheckoutService {
  private readonly logger = new Logger(SubscriptionCheckoutService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private payments: PaymentsService,
    private subscriptions: SubscriptionsService,
  ) {}

  /**
   * Starts a checkout for an EXISTING subscription the tenant already owns
   * (created via createTrial in Phase 18, or a prior checkout). Never
   * creates a new Subscription row itself — this only pays for one that
   * already exists, moving it toward ACTIVE once the webhook confirms
   * payment.
   */
  async createCheckout(tenantId: string, actorUserId: string, subscriptionId: string, successUrl: string, cancelUrl: string) {
    // getCurrent()/getOwned() equivalent — reuse SubscriptionsService so
    // "does this subscription belong to this tenant" has exactly one
    // implementation in the app.
    const subscription = await this.subscriptions.getCurrent(tenantId);
    if (subscription.id !== subscriptionId) {
      throw new NotFoundException('Subscription not found');
    }

    const plan = await this.subscriptions.getCurrentPlan(tenantId);
    const amountSen = Math.round(Number(plan.priceMonthly) * 100);

    const result = await this.payments.createCheckout(tenantId, actorUserId, {
      referenceType: 'Subscription',
      referenceId: subscription.id,
      amount: { amount: amountSen, currency: plan.currency || 'MYR' },
      description: `${plan.name} subscription`,
      successUrl,
      cancelUrl,
      metadata: { callbackUrl: process.env.BILLPLZ_CALLBACK_URL || '' },
    });

    const checkout = await this.prisma.subscriptionCheckout.create({
      data: {
        tenantId,
        subscriptionId: subscription.id,
        planId: plan.id,
        provider: this.payments.providerName,
        providerReference: result.providerReference,
        // Only the signed webhook may finalize/activate a subscription.
        // Even if the provider adapter reports SUCCEEDED immediately, keep
        // the local row PENDING so the verified webhook can acquire its
        // lease, validate amount/currency, activate, and mark it processed.
        status: 'PENDING',
        amount: amountSen / 100,
        currency: plan.currency || 'MYR',
        checkoutUrl: result.checkoutUrl,
      },
    });

    return checkout;
  }

  /**
   * Read-only status lookup for the checkout-result page a customer's
   * browser lands on after a payment redirect. Deliberately does NOT
   * activate anything — it only re-queries the provider (never trusts a
   * client-supplied "I paid" claim) to show an up-to-date status, and it
   * checks tenant ownership so one tenant can't probe another's checkout
   * reference. Roadmap requirement: "a browser success redirect must not
   * activate a subscription" — enforced structurally by this method never
   * calling SubscriptionsService.activate().
   */
  async getCheckoutStatusForOwner(tenantId: string, providerReference: string) {
    const checkout = await this.prisma.subscriptionCheckout.findFirst({
      where: { providerReference, tenantId },
    });
    if (!checkout) throw new NotFoundException('Checkout not found');

    // Re-verify against the provider rather than trusting our own PENDING
    // row — the webhook may not have arrived yet even though the provider
    // itself already shows the payment as settled. A provider "success" is
    // not sufficient unless the amount and currency match this tenant-owned
    // checkout record; otherwise a wrong bill could appear paid in the UI.
    const live = await this.payments.verifyPayment(providerReference);
    if (live.status === 'SUCCEEDED') {
      const expectedAmountMinor = Math.round(Number(checkout.amount) * 100);
      const verifiedAmountMinor = Number(live.amount?.amount);
      const expectedCurrency = String(checkout.currency || '').toUpperCase();
      const verifiedCurrency = String(live.amount?.currency || '').toUpperCase();
      if (!Number.isSafeInteger(expectedAmountMinor) || expectedAmountMinor <= 0 ||
          !Number.isSafeInteger(verifiedAmountMinor) || verifiedAmountMinor !== expectedAmountMinor ||
          !expectedCurrency || verifiedCurrency !== expectedCurrency) {
        this.logger.error('Billplz checkout-status verification mismatch; success withheld');
        await this.audit.log({
          tenantId,
          userId: undefined,
          action: 'SUBSCRIPTION_CHECKOUT_STATUS_MISMATCH',
          entityType: 'SubscriptionCheckout',
          entityId: checkout.id,
          newValues: {
            providerReference,
            expectedAmountMinor,
            verifiedAmountMinor: Number.isSafeInteger(verifiedAmountMinor) ? verifiedAmountMinor : null,
            expectedCurrency,
            verifiedCurrency,
          },
        });
        throw new BadRequestException('Verified payment amount or currency does not match checkout');
      }
    }
    return { providerReference, status: live.status, amount: live.amount, paidAt: live.paidAt };
  }

  /**
   * Handles a verified Billplz callback. Signature verification happens
   * here (not the controller) so it's covered by the same unit tests as
   * the rest of the webhook logic. Idempotent: a providerReference already
   * moved to a terminal state is a no-op, since providers retry webhook
   * delivery and Billplz gives no unique event id to dedupe on otherwise.
   */
  async handleBillplzWebhook(fields: Record<string, string | undefined>) {
    const signatureKey = process.env.BILLPLZ_X_SIGNATURE_KEY;
    if (!signatureKey) throw new BadRequestException('BILLPLZ_X_SIGNATURE_KEY is not configured');
    if (!verifyBillplzSignature(fields, signatureKey)) {
      throw new UnauthorizedException('Invalid Billplz webhook signature');
    }

    const providerReference = fields['id'];
    if (!providerReference) throw new BadRequestException('Missing bill id in Billplz webhook');

    const checkout: CheckoutRecord | null = await this.prisma.subscriptionCheckout.findUnique({
      where: { providerReference },
    });
    if (!checkout) {
      // A signed webhook for a bill we have no record of at all is not
      // this tenant's/app's problem to solve — could be a stale
      // collection, a manually-created bill outside this flow, etc. Log
      // and accept (200) rather than error, since Billplz will retry an
      // error response indefinitely.
      this.logger.warn(`Billplz webhook for unknown providerReference ${providerReference}`);
      return { received: true, matched: false };
    }

    // A provider reference is globally unique, but that alone does not
    // prove this callback came from the provider that owns the checkout.
    // Never let a Billplz callback finalize a row created for another provider.
    if (String(checkout.provider).toLowerCase() !== 'billplz') {
      this.logger.warn('Billplz webhook provider mismatch for checkout ' + checkout.id);
      await this.audit.log({
        tenantId: checkout.tenantId,
        userId: undefined,
        action: 'SUBSCRIPTION_CHECKOUT_PROVIDER_MISMATCH',
        entityType: 'SubscriptionCheckout',
        entityId: checkout.id,
        newValues: { receivedProvider: 'billplz', expectedProvider: checkout.provider },
      });
      return { received: true, matched: false };
    }

    if (checkout.webhookProcessedAt) {
      // Already terminal — replayed delivery, not an error.
      return { received: true, duplicate: true, status: checkout.status };
    }

    // Never trust the webhook payload's own `paid` field for the final
    // decision — re-query Billplz's API directly (verifyPayment) as the
    // single source of truth, the same call the redirect-status endpoint
    // uses. This means even a forged-but-signed replay of an old PENDING
    // payload can't move a bill that never actually paid.
    const verified = await this.payments.verifyPayment(providerReference);

    if (verified.status === 'SUCCEEDED') {
      // A successful provider status alone is not enough: bind the verified
      // amount/currency to the immutable amount recorded for this checkout.
      // This prevents a different or partially paid bill from activating a plan.
      const expectedAmountMinor = Math.round(Number(checkout.amount) * 100);
      const verifiedAmountMinor = Number(verified.amount?.amount);
      const expectedCurrency = String(checkout.currency || '').toUpperCase();
      const verifiedCurrency = String(verified.amount?.currency || '').toUpperCase();
      if (!Number.isSafeInteger(expectedAmountMinor) || expectedAmountMinor <= 0 ||
          !Number.isSafeInteger(verifiedAmountMinor) || verifiedAmountMinor !== expectedAmountMinor ||
          !expectedCurrency || verifiedCurrency !== expectedCurrency) {
        this.logger.error('Billplz payment verification mismatch; subscription activation withheld');
        await this.audit.log({
          tenantId: checkout.tenantId,
          userId: undefined,
          action: 'SUBSCRIPTION_CHECKOUT_VERIFICATION_MISMATCH',
          entityType: 'SubscriptionCheckout',
          entityId: checkout.id,
          newValues: {
            providerReference,
            expectedAmountMinor,
            verifiedAmountMinor: Number.isSafeInteger(verifiedAmountMinor) ? verifiedAmountMinor : null,
            expectedCurrency,
            verifiedCurrency,
          },
        });
        throw new BadRequestException('Verified payment amount or currency does not match checkout');
      }

      // Atomically acquire a short lease so concurrent webhook deliveries
      // cannot both activate the same checkout. A stale lease is reclaimable
      // after a worker crash; activation is idempotent for an ACTIVE subscription.
      const claimedAt = new Date();
      const staleBefore = new Date(claimedAt.getTime() - 2 * 60 * 1000);
      const claim = await this.prisma.subscriptionCheckout.updateMany({
        where: {
          id: checkout.id,
          status: 'PENDING',
          webhookProcessedAt: null,
          OR: [
            { webhookProcessingAt: null },
            { webhookProcessingAt: { lt: staleBefore } },
          ],
        },
        data: { webhookProcessingAt: claimedAt },
      });
      if (claim.count !== 1) {
        const latest: CheckoutRecord | null = await this.prisma.subscriptionCheckout.findUnique({
          where: { id: checkout.id },
        });
        if (latest?.webhookProcessedAt) {
          return { received: true, duplicate: true, status: latest.status };
        }
        // Another worker owns the lease. Acknowledge the delivery; the
        // provider's own verification and stale-lease recovery handle retries.
        return { received: true, processing: true, status: latest?.status ?? checkout.status };
      }

      try {
        await this.subscriptions.activate(checkout.tenantId, checkout.subscriptionId, SYSTEM_ACTOR);
        await this.prisma.subscriptionCheckout.update({
          where: { id: checkout.id },
          data: {
            status: 'SUCCEEDED',
            webhookProcessedAt: new Date(),
            webhookProcessingAt: null,
          },
        });
      } catch (error) {
        // Leave it retryable immediately when the operation reports failure.
        // If the process dies before this cleanup, the lease expires in 2 min.
        await this.prisma.subscriptionCheckout.updateMany({
          where: { id: checkout.id, webhookProcessingAt: claimedAt, webhookProcessedAt: null },
          data: { webhookProcessingAt: null },
        });
        throw error;
      }
      await this.audit.log({
        tenantId: checkout.tenantId,
        userId: undefined,
        action: 'SUBSCRIPTION_CHECKOUT_SUCCEEDED',
        entityType: 'SubscriptionCheckout',
        entityId: checkout.id,
        newValues: { providerReference, provider: checkout.provider },
      });
      return { received: true, status: 'SUCCEEDED' };
    }

    // Not yet paid — Billplz has no explicit "failed" bill state (see
    // BillplzPaymentProvider.mapStatus), so a webhook that isn't SUCCEEDED
    // just means "still pending" from Billplz's own point of view. Record
    // the webhook hit without marking the checkout terminal, so a later
    // genuine success webhook can still complete it.
    await this.audit.log({
      tenantId: checkout.tenantId,
      userId: undefined,
      action: 'SUBSCRIPTION_CHECKOUT_WEBHOOK_RECEIVED',
      entityType: 'SubscriptionCheckout',
      entityId: checkout.id,
      newValues: { providerReference, status: verified.status },
    });
    return { received: true, status: verified.status };
  }
}
