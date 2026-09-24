import { query } from '../database/connection.js';

export const logError = async ({ requestId, service, route, errorType, errorMessage, businessId, userId, stackTrace, metadata }) => {
  const result = await query(
    `INSERT INTO system_errors (request_id, service, route, error_type, error_message, business_id, user_id, stack_trace, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [requestId, service, route, errorType, errorMessage, businessId, userId, stackTrace, JSON.stringify(metadata || {})]
  );
  return result.rows[0];
};

export const getErrors = async (filters = {}) => {
  let sql = `SELECT * FROM system_errors WHERE 1=1`;
  const params = [];
  let idx = 1;
  if (filters.service) { sql += ` AND service = $${idx}`; params.push(filters.service); idx++; }
  if (filters.resolved !== undefined) { sql += ` AND resolved = $${idx}`; params.push(filters.resolved); idx++; }
  if (filters.businessId) { sql += ` AND business_id = $${idx}`; params.push(filters.businessId); idx++; }
  sql += ` ORDER BY created_at DESC LIMIT $${idx}`;
  params.push(filters.limit || 100);
  const result = await query(sql, params);
  return result.rows;
};

export const resolveError = async (errorId, resolvedBy) => {
  const result = await query(
    `UPDATE system_errors SET resolved = true, resolved_at = NOW(), resolved_by = $1 WHERE id = $2 RETURNING *`,
    [resolvedBy, errorId]
  );
  return result.rows[0] || null;
};

export const getSystemHealth = async () => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const [dbCheck, errorCount, alertCount] = await Promise.all([
    query(`SELECT 1 as db_ok`).catch(() => ({ rows: [{ db_ok: false }] })),
    query(`SELECT COUNT(*) as c FROM system_errors WHERE created_at > $1 AND resolved = false`, [oneHourAgo]),
    query(`SELECT COUNT(*) as c FROM alert_history WHERE created_at > $1 AND acknowledged = false`, [oneHourAgo]),
  ]);

  return {
    timestamp: now.toISOString(),
    database: dbCheck.rows[0]?.db_ok === 1 ? 'healthy' : 'unhealthy',
    errors_last_hour: parseInt(errorCount.rows[0].c, 10),
    unacknowledged_alerts: parseInt(alertCount.rows[0].c, 10),
  };
};

export const getPlatformMetrics = async () => {
  const result = await query(
    `SELECT
      (SELECT COUNT(*) FROM businesses WHERE status IN ('trial', 'active')) as total_businesses,
      (SELECT COUNT(*) FROM businesses WHERE status = 'trial') as trial_businesses,
      (SELECT COUNT(*) FROM businesses WHERE status = 'active') as active_businesses,
      (SELECT COUNT(*) FROM subscriptions WHERE status = 'ACTIVE') as active_subscriptions,
      (SELECT COUNT(*) FROM subscriptions WHERE status = 'CANCELLED') as cancelled_subscriptions,
      (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status != 'cancelled' AND created_at >= DATE_TRUNC('month', NOW())) as monthly_gmv,
      (SELECT COUNT(*) FROM orders WHERE status != 'cancelled' AND created_at >= DATE_TRUNC('month', NOW())) as monthly_orders,
      (SELECT COUNT(*) FROM whatsapp_messages WHERE created_at >= DATE_TRUNC('month', NOW())) as monthly_messages,
      (SELECT COUNT(*) FROM support_tickets WHERE status NOT IN ('RESOLVED', 'CLOSED')) as open_tickets,
      (SELECT COALESCE(SUM(estimated_cost), 0) FROM ai_usage WHERE created_at >= DATE_TRUNC('month', NOW())) as monthly_ai_cost
    `
  );
  return result.rows[0];
};
