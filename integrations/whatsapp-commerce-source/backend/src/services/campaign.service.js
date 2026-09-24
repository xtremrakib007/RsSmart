import { query, getPool } from '../database/connection.js';
import { checkFeatureLimit } from './featureLimit.service.js';

export const createCampaign = async (data, userId, businessId) => {
  await checkFeatureLimit(businessId, 'campaigns');
  const result = await query(
    `INSERT INTO campaigns
     (business_id, name, type, audience_segment, audience_tags, audience_min_spending,
      audience_min_orders, audience_last_order_days, template_id, status, content, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [businessId, data.name, data.type, data.audienceSegment || null, data.audienceTags || null,
     data.audienceMinSpending || null, data.audienceMinOrders || null, data.audienceLastOrderDays || null,
     data.templateId || null, data.status || 'DRAFT', data.content || null, userId]
  );
  return result.rows[0];
};

export const getCampaigns = async (filters, businessId) => {
  let sql = `SELECT c.*, u.full_name as created_by_name
             FROM campaigns c LEFT JOIN users u ON c.created_by = u.id
             WHERE c.business_id = $1`;
  const params = [businessId];
  let idx = 2;
  if (filters.status) { sql += ` AND c.status = $${idx}`; params.push(filters.status); idx++; }
  sql += ` ORDER BY c.created_at DESC`;
  const result = await query(sql, params);
  return result.rows;
};

export const getCampaignById = async (id, businessId) => {
  const result = await query(
    `SELECT c.*, u.full_name as created_by_name
     FROM campaigns c LEFT JOIN users u ON c.created_by = u.id
     WHERE c.id = $1 AND c.business_id = $2`,
    [id, businessId]
  );
  return result.rows[0] || null;
};

export const updateCampaignStatus = async (id, businessId, status) => {
  const result = await query(
    `UPDATE campaigns SET status = $3, updated_at = NOW() WHERE id = $1 AND business_id = $2 RETURNING *`,
    [id, businessId, status]
  );
  return result.rows[0] || null;
};

export const buildAudience = async (campaignId, businessId) => {
  const campaignResult = await query(
    `SELECT * FROM campaigns WHERE id = $1 AND business_id = $2`,
    [campaignId, businessId]
  );
  const campaign = campaignResult.rows[0];
  if (!campaign) throw new Error('Campaign not found.');

  let sql = `
    SELECT id, phone, full_name
    FROM customers
    WHERE business_id = $1
      AND is_active = true
      AND promotional_opt_out = false
  `;
  const params = [businessId];
  let idx = 2;

  if (campaign.audience_segment) {
    switch (campaign.audience_segment) {
      case 'NEW_CUSTOMER':
        sql += ` AND total_orders <= 1`; break;
      case 'REPEAT_CUSTOMER':
        sql += ` AND total_orders >= 2`; break;
      case 'VIP_CUSTOMER':
        sql += ` AND tags @> ARRAY['VIP']`; break;
      case 'B2B_CUSTOMER':
        sql += ` AND customer_type = 'b2b'`; break;
      case 'HIGH_VALUE_CUSTOMER':
        sql += ` AND total_spent > 1000`; break;
      case 'INACTIVE_CUSTOMER':
        sql += ` AND last_order_at < NOW() - INTERVAL '90 days'`; break;
    }
  }

  if (campaign.audience_tags && campaign.audience_tags.length > 0) {
    sql += ` AND tags && $${idx}`;
    params.push(campaign.audience_tags);
    idx++;
  }

  if (campaign.audience_min_spending) {
    sql += ` AND total_spent >= $${idx}`;
    params.push(campaign.audience_min_spending);
    idx++;
  }

  if (campaign.audience_min_orders) {
    sql += ` AND total_orders >= $${idx}`;
    params.push(campaign.audience_min_orders);
    idx++;
  }

  if (campaign.audience_last_order_days) {
    sql += ` AND (last_order_at IS NULL OR last_order_at < NOW() - INTERVAL '${campaign.audience_last_order_days} days')`;
  }

  const result = await query(sql, params);
  return result.rows;
};

export const queueCampaign = async (campaignId, businessId) => {
  const audience = await buildAudience(campaignId, businessId);
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    for (const customer of audience) {
      await client.query(
        `INSERT INTO campaign_queue (business_id, campaign_id, customer_id, phone, status)
         VALUES ($1,$2,$3,$4,'pending')
         ON CONFLICT (campaign_id, customer_id) DO NOTHING`,
        [businessId, campaignId, customer.id, customer.phone]
      );
    }
    await client.query(
      `UPDATE campaigns SET status = 'SCHEDULED', updated_at = NOW() WHERE id = $1`,
      [campaignId]
    );
    await client.query('COMMIT');
    return { queued: audience.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const getPendingQueueItems = async (businessId, limit = 50) => {
  const result = await query(
    `SELECT cq.*, c.name as campaign_name, c.content as campaign_content, c.template_id
     FROM campaign_queue cq
     JOIN campaigns c ON cq.campaign_id = c.id
     WHERE cq.business_id = $1 AND cq.status = 'pending'
     ORDER BY cq.created_at ASC
     LIMIT $2 FOR UPDATE SKIP LOCKED`,
    [businessId, limit]
  );
  return result.rows;
};

export const markQueueItemSent = async (queueId, externalMessageId) => {
  await query(
    `UPDATE campaign_queue SET status = 'sent', external_message_id = $2, sent_at = NOW() WHERE id = $1`,
    [queueId, externalMessageId]
  );
};

export const markQueueItemStatus = async (queueId, status) => {
  const field = status === 'delivered' ? 'delivered_at' : status === 'read' ? 'read_at' : null;
  const updates = [`status = $2`];
  if (field) updates.push(`${field} = NOW()`);
  await query(
    `UPDATE campaign_queue SET ${updates.join(', ')} WHERE id = $1`,
    [queueId, status]
  );
};

export const getCampaignStats = async (campaignId, businessId) => {
  const result = await query(
    `SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'sent') as sent,
      COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
      COUNT(*) FILTER (WHERE status = 'read') as read,
      COUNT(*) FILTER (WHERE status = 'failed') as failed
     FROM campaign_queue WHERE campaign_id = $1 AND business_id = $2`,
    [campaignId, businessId]
  );
  return result.rows[0];
};
