import { query, getPool } from '../database/connection.js';
import crypto from 'crypto';

const ONBOARDING_STEPS = [
  'account_created',
  'business_created',
  'business_info',
  'whatsapp_connected',
  'product_added',
  'payment_configured',
  'delivery_configured',
  'staff_invited',
  'completed'
];

export const getOnboardingProgress = async (businessId, userId) => {
  const result = await query(
    `SELECT step, completed, completed_at, data FROM onboarding_progress
     WHERE business_id = $1 AND user_id = $2
     ORDER BY created_at ASC`,
    [businessId, userId]
  );
  const completed = result.rows.map(r => r.step);
  const progress = {};
  ONBOARDING_STEPS.forEach(step => {
    const row = result.rows.find(r => r.step === step);
    progress[step] = { completed: !!row?.completed, completedAt: row?.completed_at, data: row?.data || {} };
  });
  return { steps: progress, completedSteps: completed, totalSteps: ONBOARDING_STEPS.length };
};

export const completeStep = async (businessId, userId, step, data = {}) => {
  const result = await query(
    `INSERT INTO onboarding_progress (business_id, user_id, step, completed, completed_at, data)
     VALUES ($1, $2, $3, true, NOW(), $4)
     ON CONFLICT (business_id, step) DO UPDATE SET
       completed = true, completed_at = NOW(), data = EXCLUDED.data, updated_at = NOW()
     RETURNING *`,
    [businessId, userId, step, JSON.stringify(data)]
  );
  return result.rows[0];
};

export const skipStep = async (businessId, userId, step) => {
  return completeStep(businessId, userId, step, { skipped: true });
};

export const isOnboardingComplete = async (businessId) => {
  const result = await query(
    `SELECT onboarding_completed FROM businesses WHERE id = $1`,
    [businessId]
  );
  return result.rows[0]?.onboarding_completed === true;
};

export const finishOnboarding = async (businessId) => {
  const result = await query(
    `UPDATE businesses SET onboarding_completed = true, onboarding_completed_at = NOW(), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [businessId]
  );
  return result.rows[0];
};

export const createBusinessWithOnboarding = async (data, userId) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create business
    const slug = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + crypto.randomBytes(4).toString('hex');
    const bizResult = await client.query(
      `INSERT INTO businesses (name, slug, phone, email, address, city, state, country, currency, timezone, status, country_code, business_type, logo_url, website, postal_code, onboarding_started_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW()) RETURNING *`,
      [data.name, slug, data.phone || null, data.email || null, data.address || null,
       data.city || null, data.state || null, data.country || 'Malaysia',
       data.currency || 'MYR', data.timezone || 'Asia/Kuala_Lumpur', 'trial',
       data.countryCode || 'MY', data.businessType || null, data.logoUrl || null,
       data.website || null, data.postalCode || null]
    );
    const business = bizResult.rows[0];

    // Get OWNER role
    const roleResult = await client.query(
      `SELECT id FROM roles WHERE name = 'OWNER' AND business_id IS NULL LIMIT 1`
    );
    const ownerRoleId = roleResult.rows[0].id;

    // Link user as OWNER
    await client.query(
      `INSERT INTO business_users (business_id, user_id, role_id, status) VALUES ($1, $2, $3, 'active')`,
      [business.id, userId, ownerRoleId]
    );

    // Create default settings
    await client.query(
      `INSERT INTO settings (key, value, data_type, category, business_id) VALUES
       ('currency', $1, 'string', 'business', $2),
       ('timezone', $3, 'string', 'business', $2),
       ('store_name', $4, 'string', 'business', $2)`,
      [data.currency || 'MYR', business.id, data.timezone || 'Asia/Kuala_Lumpur', data.name]
    );

    // Create default invoice settings
    await client.query(
      `INSERT INTO invoice_settings (business_id) VALUES ($1)`,
      [business.id]
    );

    // Create default language
    await client.query(
      `INSERT INTO business_languages (business_id, language_code, is_default, is_active) VALUES ($1, 'en', true, true)`,
      [business.id]
    );

    // Create default subscription (FREE plan trial)
    const planResult = await client.query(`SELECT id FROM plans WHERE code = 'FREE' LIMIT 1`);
    if (planResult.rows.length > 0) {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);
      await client.query(
        `INSERT INTO subscriptions (business_id, plan_id, provider, status, current_period_start, current_period_end, trial_start, trial_end)
         VALUES ($1, $2, 'mock', 'TRIALING', NOW(), $3, NOW(), $3)`,
        [business.id, planResult.rows[0].id, trialEnd]
      );
    }

    // Mark account_created and business_created steps
    await client.query(
      `INSERT INTO onboarding_progress (business_id, user_id, step, completed, completed_at, data)
       VALUES ($1, $2, 'account_created', true, NOW(), '{}'),
              ($1, $2, 'business_created', true, NOW(), '{}')`,
      [business.id, userId]
    );

    await client.query('COMMIT');
    return business;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const validateOnboardingCompletion = async (businessId) => {
  const checks = await query(
    `SELECT
      (SELECT COUNT(*) FROM products WHERE business_id = $1 AND is_active = true) as product_count,
      (SELECT COUNT(*) FROM whatsapp_accounts WHERE business_id = $1 AND status = 'connected') as whatsapp_connected,
      (SELECT COUNT(*) FROM payments WHERE business_id = $1 LIMIT 1) as has_payment_config,
      (SELECT COUNT(*) FROM deliveries WHERE business_id = $1 LIMIT 1) as has_delivery_config`,
    [businessId]
  );
  return checks.rows[0];
};
