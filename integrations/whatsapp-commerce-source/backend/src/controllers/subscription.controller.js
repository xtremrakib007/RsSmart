import { asyncHandler } from '../middleware/asyncHandler.js';
import * as subscriptionService from '../services/subscription.service.js';
import * as featureLimitService from '../services/featureLimit.service.js';
import { getBillingProvider } from '../services/billingProvider.service.js';

export const getPlans = asyncHandler(async (req, res) => {
  const data = await subscriptionService.getPlans();
  res.status(200).json({ success: true, data: { plans: data } });
});

export const getBusinessSubscription = asyncHandler(async (req, res) => {
  const data = await subscriptionService.getBusinessSubscription(req.businessContext.businessId);
  const limits = await featureLimitService.getBusinessLimits(req.businessContext.businessId);
  res.status(200).json({ success: true, data: { subscription: data, limits } });
});

export const createSubscription = asyncHandler(async (req, res) => {
  const { planCode, provider = 'mock' } = req.body;
  const plan = await subscriptionService.getPlanByCode(planCode);
  if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });

  const billingProvider = getBillingProvider(provider);
  const customer = await billingProvider.createCustomer({
    email: req.user.email,
    name: req.user.fullName,
    metadata: { business_id: req.businessContext.businessId }
  });

  const sub = await billingProvider.createSubscription({
    customerId: customer.id,
    planCode: plan.code,
    trialDays: 14
  });

  const data = await subscriptionService.createSubscription({
    businessId: req.businessContext.businessId,
    planId: plan.id,
    provider,
    providerCustomerId: customer.id,
    providerSubscriptionId: sub.id,
    status: sub.status === 'trialing' ? 'TRIALING' : 'ACTIVE',
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
    trialStart: sub.trialStart,
    trialEnd: sub.trialEnd
  });

  res.status(201).json({ success: true, data: { subscription: data } });
});

export const cancelSubscription = asyncHandler(async (req, res) => {
  const sub = await subscriptionService.getBusinessSubscription(req.businessContext.businessId);
  if (!sub) return res.status(404).json({ success: false, message: 'No active subscription.' });

  const billingProvider = getBillingProvider(sub.provider);
  await billingProvider.cancelSubscription(sub.provider_subscription_id);

  const data = await subscriptionService.updateSubscriptionStatus(sub.id, req.businessContext.businessId, {
    status: 'CANCELLED',
    cancelAtPeriodEnd: true,
    cancelledAt: new Date().toISOString()
  });

  res.status(200).json({ success: true, data: { subscription: data } });
});

export const getFeatureStatus = asyncHandler(async (req, res) => {
  const { feature } = req.query;
  if (!feature) return res.status(400).json({ success: false, message: 'feature query param required.' });
  const usage = await featureLimitService.getCurrentUsage(req.businessContext.businessId, feature);
  const result = await featureLimitService.canUseFeature(req.businessContext.businessId, feature, usage);
  res.status(200).json({ success: true, data: { feature, usage, ...result } });
});
