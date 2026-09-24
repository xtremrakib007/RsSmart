import { query } from '../database/connection.js';
import { getBusinessSubscription, getPlanByCode } from './subscription.service.js';

const DEFAULT_LIMITS = {
  FREE: { products: 50, customers: 200, staff_users: 1, conversations_monthly: 500, campaigns: 0, automation_rules: 2, storage_mb: 100, analytics_retention_days: 7, ai_messages: 0 },
  STARTER: { products: 500, customers: 2000, staff_users: 3, conversations_monthly: 5000, campaigns: 5, automation_rules: 10, storage_mb: 1000, analytics_retention_days: 30, ai_messages: 100 },
  PRO: { products: 5000, customers: 20000, staff_users: 10, conversations_monthly: 50000, campaigns: 50, automation_rules: 50, storage_mb: 10000, analytics_retention_days: 90, ai_messages: 1000 },
  BUSINESS: { products: 0, customers: 0, staff_users: 50, conversations_monthly: 200000, campaigns: 200, automation_rules: 200, storage_mb: 50000, analytics_retention_days: 365, ai_messages: 10000 },
  ENTERPRISE: { products: 0, customers: 0, staff_users: 0, conversations_monthly: 0, campaigns: 0, automation_rules: 0, storage_mb: 0, analytics_retention_days: 0, ai_messages: 0 },
};

export const getBusinessLimits = async (businessId) => {
  const sub = await getBusinessSubscription(businessId);
  if (!sub) {
    return { planCode: 'FREE', limits: DEFAULT_LIMITS.FREE };
  }
  const plan = await getPlanByCode(sub.plan_code);
  if (!plan) {
    return { planCode: sub.plan_code || 'FREE', limits: DEFAULT_LIMITS.FREE };
  }
  return { planCode: plan.code, limits: plan.features || DEFAULT_LIMITS[plan.code] || DEFAULT_LIMITS.FREE };
};

export const canUseFeature = async (businessId, feature, usage = 0) => {
  const { limits } = await getBusinessLimits(businessId);
  const limit = limits[feature];
  if (limit === undefined) return { allowed: true, limit: 0, remaining: 0 };
  if (limit === 0) return { allowed: true, limit: 0, remaining: Infinity };
  if (limit === -1) return { allowed: false, limit: -1, remaining: 0, reason: 'Feature disabled on current plan.' };
  const allowed = usage < limit;
  return { allowed, limit, remaining: Math.max(0, limit - usage), reason: allowed ? null : `Plan limit reached: ${limit}` };
};

export const getCurrentUsage = async (businessId, feature) => {
  switch (feature) {
    case 'products':
      const pr = await query(`SELECT COUNT(*) as c FROM products WHERE business_id = $1`, [businessId]);
      return parseInt(pr.rows[0].c, 10);
    case 'customers':
      const cr = await query(`SELECT COUNT(*) as c FROM customers WHERE business_id = $1`, [businessId]);
      return parseInt(cr.rows[0].c, 10);
    case 'staff_users':
      const sr = await query(`SELECT COUNT(*) as c FROM business_users WHERE business_id = $1`, [businessId]);
      return parseInt(sr.rows[0].c, 10);
    case 'conversations_monthly':
      const cm = await query(
        `SELECT COUNT(*) as c FROM whatsapp_conversations
         WHERE business_id = $1 AND created_at >= DATE_TRUNC('month', NOW())`,
        [businessId]
      );
      return parseInt(cm.rows[0].c, 10);
    case 'campaigns':
      const cam = await query(`SELECT COUNT(*) as c FROM campaigns WHERE business_id = $1`, [businessId]);
      return parseInt(cam.rows[0].c, 10);
    case 'ai_messages':
      const ai = await query(
        `SELECT COUNT(*) as c FROM ai_usage
         WHERE business_id = $1 AND created_at >= DATE_TRUNC('month', NOW())`,
        [businessId]
      );
      return parseInt(ai.rows[0].c, 10);
    default:
      return 0;
  }
};

export const checkFeatureLimit = async (businessId, feature) => {
  const usage = await getCurrentUsage(businessId, feature);
  const result = await canUseFeature(businessId, feature, usage);
  if (!result.allowed) {
    const error = new Error(result.reason || 'Plan limit reached.');
    error.code = 'PLAN_LIMIT_REACHED';
    error.statusCode = 403;
    throw error;
  }
  return result;
};
