import { query } from '../database/connection.js';

export const getLegalPages = async (businessId, pageType = null) => {
  let sql = `SELECT id, page_type, title, content, version, is_published, published_at, updated_at
             FROM legal_pages WHERE business_id = $1`;
  const params = [businessId];
  if (pageType) { sql += ` AND page_type = $2`; params.push(pageType); }
  sql += ` ORDER BY page_type, version DESC`;
  const result = await query(sql, params);
  return result.rows;
};

export const getPublishedLegalPage = async (businessId, pageType) => {
  const result = await query(
    `SELECT * FROM legal_pages WHERE business_id = $1 AND page_type = $2 AND is_published = true
     ORDER BY version DESC LIMIT 1`,
    [businessId, pageType]
  );
  return result.rows[0] || null;
};

export const createLegalPage = async (businessId, data) => {
  const result = await query(
    `INSERT INTO legal_pages (business_id, page_type, title, content, version, is_published)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [businessId, data.pageType, data.title, data.content, data.version || '1.0', data.isPublished || false]
  );
  return result.rows[0];
};

export const updateLegalPage = async (id, businessId, data) => {
  const sets = [];
  const params = [];
  let idx = 1;
  if (data.title) { sets.push(`title = $${idx}`); params.push(data.title); idx++; }
  if (data.content) { sets.push(`content = $${idx}`); params.push(data.content); idx++; }
  if (data.version) { sets.push(`version = $${idx}`); params.push(data.version); idx++; }
  if (data.isPublished !== undefined) {
    sets.push(`is_published = $${idx}`);
    params.push(data.isPublished);
    idx++;
    if (data.isPublished) { sets.push(`published_at = NOW()`); }
  }
  sets.push(`updated_at = NOW()`);
  params.push(id);
  params.push(businessId);
  const result = await query(
    `UPDATE legal_pages SET ${sets.join(', ')} WHERE id = $${idx} AND business_id = $${idx + 1} RETURNING *`,
    params
  );
  return result.rows[0] || null;
};

export const recordConsent = async ({ businessId, customerId, userId, consentType, version, source, ipAddress, userAgent, accepted }) => {
  const result = await query(
    `INSERT INTO consent_records (business_id, customer_id, user_id, consent_type, version, source, ip_address, user_agent, accepted)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [businessId, customerId || null, userId || null, consentType, version, source, ipAddress || null, userAgent || null, accepted !== false]
  );
  return result.rows[0];
};

export const getConsentRecords = async (filters) => {
  let sql = `SELECT * FROM consent_records WHERE 1=1`;
  const params = [];
  let idx = 1;
  if (filters.businessId) { sql += ` AND business_id = $${idx}`; params.push(filters.businessId); idx++; }
  if (filters.customerId) { sql += ` AND customer_id = $${idx}`; params.push(filters.customerId); idx++; }
  if (filters.userId) { sql += ` AND user_id = $${idx}`; params.push(filters.userId); idx++; }
  if (filters.consentType) { sql += ` AND consent_type = $${idx}`; params.push(filters.consentType); idx++; }
  sql += ` ORDER BY created_at DESC LIMIT $${idx}`;
  params.push(filters.limit || 100);
  const result = await query(sql, params);
  return result.rows;
};

export const createDataRequest = async ({ businessId, customerId, userId, requestType, reason }) => {
  const result = await query(
    `INSERT INTO data_export_requests (business_id, customer_id, user_id, request_type, reason, status)
     VALUES ($1,$2,$3,$4,$5,'pending') RETURNING *`,
    [businessId, customerId || null, userId || null, requestType, reason]
  );
  return result.rows[0];
};

export const getDataRequests = async (filters) => {
  let sql = `SELECT * FROM data_export_requests WHERE 1=1`;
  const params = [];
  let idx = 1;
  if (filters.businessId) { sql += ` AND business_id = $${idx}`; params.push(filters.businessId); idx++; }
  if (filters.status) { sql += ` AND status = $${idx}`; params.push(filters.status); idx++; }
  sql += ` ORDER BY created_at DESC`;
  const result = await query(sql, params);
  return result.rows;
};

export const processDataRequest = async (requestId, { status, processedBy, resultUrl }) => {
  const result = await query(
    `UPDATE data_export_requests SET status = $1, processed_at = NOW(), processed_by = $2, result_url = $3, updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [status, processedBy, resultUrl || null, requestId]
  );
  return result.rows[0] || null;
};

export const generateCustomerDataExport = async (businessId, customerId) => {
  // Gather all customer data safely
  const [customer, orders, conversations, payments, loyalty, consents] = await Promise.all([
    query(`SELECT id, full_name, email, phone, address, city, state, country, customer_type, tags, total_orders, total_spent, created_at, updated_at
           FROM customers WHERE id = $1 AND business_id = $2`, [customerId, businessId]),
    query(`SELECT id, order_number, status, subtotal, total_amount, currency, delivery_address, created_at
           FROM orders WHERE customer_id = $1 AND business_id = $2`, [customerId, businessId]),
    query(`SELECT id, phone, last_message, created_at FROM whatsapp_conversations WHERE customer_id = $1 AND business_id = $2`, [customerId, businessId]),
    query(`SELECT id, amount, currency, status, payment_method, paid_at FROM payments WHERE customer_id = $1 AND business_id = $2`, [customerId, businessId]),
    query(`SELECT id, type, points, balance_after, description, created_at FROM loyalty_transactions WHERE customer_id = $1 AND business_id = $2`, [customerId, businessId]),
    query(`SELECT consent_type, version, accepted, created_at FROM consent_records WHERE customer_id = $1 AND business_id = $2`, [customerId, businessId]),
  ]);

  return {
    exportDate: new Date().toISOString(),
    businessId,
    customer: customer.rows[0] || null,
    orders: orders.rows,
    conversations: conversations.rows,
    payments: payments.rows,
    loyaltyTransactions: loyalty.rows,
    consents: consents.rows,
  };
};
