import { query, getPool } from '../database/connection.js';

export const getPlans = async (includeHidden = false) => {
  const sql = `
    SELECT p.*,
      COALESCE(jsonb_object_agg(f.feature_key, f.feature_value)
        FILTER (WHERE f.feature_key IS NOT NULL), '{}') as features
    FROM plans p
    LEFT JOIN plan_features f ON f.plan_id = p.id
    WHERE p.is_active = true ${includeHidden ? '' : "AND p.is_public = true"}
    GROUP BY p.id
    ORDER BY p.sort_order ASC
  `;
  const result = await query(sql, []);
  return result.rows;
};

export const getPlanByCode = async (code) => {
  const result = await query(
    `SELECT p.*,
      COALESCE(jsonb_object_agg(f.feature_key, f.feature_value)
        FILTER (WHERE f.feature_key IS NOT NULL), '{}') as features
     FROM plans p
     LEFT JOIN plan_features f ON f.plan_id = p.id
     WHERE p.code = $1 GROUP BY p.id`,
    [code]
  );
  return result.rows[0] || null;
};

export const getBusinessSubscription = async (businessId) => {
  const result = await query(
    `SELECT s.*, p.name as plan_name, p.code as plan_code
     FROM subscriptions s
     JOIN plans p ON s.plan_id = p.id
     WHERE s.business_id = $1
     ORDER BY s.created_at DESC LIMIT 1`,
    [businessId]
  );
  return result.rows[0] || null;
};

export const createSubscription = async ({ businessId, planId, provider, providerCustomerId, providerSubscriptionId, status, currentPeriodStart, currentPeriodEnd, trialStart, trialEnd }) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE subscriptions SET status = 'CANCELLED', updated_at = NOW()
       WHERE business_id = $1 AND status IN ('TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED')`,
      [businessId]
    );
    const result = await client.query(
      `INSERT INTO subscriptions
       (business_id, plan_id, provider, provider_customer_id, provider_subscription_id, status,
        current_period_start, current_period_end, trial_start, trial_end)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [businessId, planId, provider, providerCustomerId, providerSubscriptionId, status,
       currentPeriodStart, currentPeriodEnd, trialStart, trialEnd]
    );
    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const updateSubscriptionStatus = async (subscriptionId, businessId, { status, currentPeriodEnd, cancelAtPeriodEnd, cancelledAt }) => {
  const sets = [];
  const params = [];
  let idx = 1;
  if (status) { sets.push(`status = $${idx}`); params.push(status); idx++; }
  if (currentPeriodEnd) { sets.push(`current_period_end = $${idx}`); params.push(currentPeriodEnd); idx++; }
  if (cancelAtPeriodEnd !== undefined) { sets.push(`cancel_at_period_end = $${idx}`); params.push(cancelAtPeriodEnd); idx++; }
  if (cancelledAt) { sets.push(`cancelled_at = $${idx}`); params.push(cancelledAt); idx++; }
  sets.push(`updated_at = NOW()`);
  params.push(subscriptionId);
  params.push(businessId);
  const result = await query(
    `UPDATE subscriptions SET ${sets.join(', ')} WHERE id = $${idx} AND business_id = $${idx + 1} RETURNING *`,
    params
  );
  return result.rows[0] || null;
};

export const recordSubscriptionEvent = async ({ businessId, subscriptionId, provider, eventType, providerEventId, payload }) => {
  const result = await query(
    `INSERT INTO subscription_events
     (business_id, subscription_id, provider, event_type, provider_event_id, payload, processed)
     VALUES ($1,$2,$3,$4,$5,$6,false) RETURNING *`,
    [businessId, subscriptionId, provider, eventType, providerEventId, JSON.stringify(payload)]
  );
  return result.rows[0];
};

export const markEventProcessed = async (eventId) => {
  await query(
    `UPDATE subscription_events SET processed = true, processed_at = NOW() WHERE id = $1`,
    [eventId]
  );
};
