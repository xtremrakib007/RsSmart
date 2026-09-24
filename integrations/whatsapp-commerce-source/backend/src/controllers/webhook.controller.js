import { asyncHandler } from '../middleware/asyncHandler.js';
import { query } from '../database/connection.js';
import * as subscriptionService from '../services/subscription.service.js';
import { getBillingProvider } from '../services/billingProvider.service.js';

export const handleBillingWebhook = asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const signature = req.headers['stripe-signature'] || req.headers['x-webhook-signature'] || '';

  try {
    const billingProvider = getBillingProvider(provider);
    const event = await billingProvider.constructEvent(req.body, signature, process.env.WEBHOOK_SECRET || 'test-secret');

    // Idempotency check
    const existing = await query(
      `SELECT id FROM subscription_events WHERE provider_event_id = $1 LIMIT 1`,
      [event.id]
    );
    if (existing.rows.length > 0) {
      return res.status(200).json({ success: true, message: 'Event already processed.' });
    }

    // Find subscription by provider subscription ID
    const subResult = await query(
      `SELECT * FROM subscriptions WHERE provider_subscription_id = $1`,
      [event.data?.subscription_id || event.data?.id]
    );

    if (subResult.rows.length === 0) {
      return res.status(200).json({ success: true, message: 'Subscription not found, ignored.' });
    }

    const subscription = subResult.rows[0];

    await subscriptionService.recordSubscriptionEvent({
      businessId: subscription.business_id,
      subscriptionId: subscription.id,
      provider,
      eventType: event.type,
      providerEventId: event.id,
      payload: event
    });

    // Process event
    switch (event.type) {
      case 'subscription.created':
      case 'subscription.updated':
        await subscriptionService.updateSubscriptionStatus(subscription.id, subscription.business_id, {
          status: event.data.status === 'active' ? 'ACTIVE' : event.data.status === 'trialing' ? 'TRIALING' : 'PAST_DUE',
          currentPeriodEnd: event.data.current_period_end
        });
        break;
      case 'invoice.payment_succeeded':
        await subscriptionService.updateSubscriptionStatus(subscription.id, subscription.business_id, {
          status: 'ACTIVE',
          currentPeriodEnd: event.data.period_end
        });
        break;
      case 'invoice.payment_failed':
        await subscriptionService.updateSubscriptionStatus(subscription.id, subscription.business_id, {
          status: 'PAST_DUE'
        });
        break;
      case 'customer.subscription.deleted':
        await subscriptionService.updateSubscriptionStatus(subscription.id, subscription.business_id, {
          status: 'CANCELLED',
          cancelledAt: new Date().toISOString()
        });
        break;
    }

    await subscriptionService.markEventProcessed(existing.rows[0]?.id);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(400).json({ success: false, message: 'Webhook processing failed.' });
  }
});
