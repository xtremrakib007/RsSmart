import { query } from '../database/connection.js';
import * as whatsappApi from './whatsappCloudApi.service.js';

// ============================================
// TEMPLATE RENDERER
// ============================================
export const renderTemplate = (templateBody, context) => {
  if (!templateBody) return '';
  let rendered = templateBody;

  const allowedVariables = [
    'customer_name', 'business_name', 'order_number', 'order_total',
    'currency', 'payment_status', 'order_status', 'delivery_status',
    'tracking_number', 'courier_name', 'product_name', 'staff_name'
  ];

  for (const key of allowedVariables) {
    const value = context[key] !== undefined ? String(context[key]) : '';
    rendered = rendered.replace(new RegExp(`{{\s*${key}\s*}}`, 'g'), value);
  }

  // Remove any unreplaced variables for safety
  rendered = rendered.replace(/{{\s*[\w_]+\s*}}/g, '');

  return rendered;
};

// ============================================
// EVENT PROCESSOR
// ============================================
export const processEvent = async (eventName, payload, businessId) => {
  // Get automation rules for this event
  const rulesResult = await query(
    `SELECT * FROM automation_rules WHERE business_id = $1 AND event = $2 AND enabled = true`,
    [businessId, eventName]
  );

  const results = [];

  for (const rule of rulesResult.rows) {
    try {
      // Check conditions
      if (rule.conditions && Object.keys(rule.conditions).length > 0) {
        const conditionsMet = checkConditions(rule.conditions, payload);
        if (!conditionsMet) {
          results.push({ ruleId: rule.id, status: 'skipped', reason: 'conditions_not_met' });
          continue;
        }
      }

      // Execute action
      if (rule.action === 'send_whatsapp' && rule.template_id) {
        const result = await sendWhatsAppNotification(rule.template_id, payload, businessId, eventName);
        results.push({ ruleId: rule.id, status: result.success ? 'sent' : 'failed', ...result });
      } else if (rule.action === 'send_whatsapp' && !rule.template_id) {
        // Fallback: send a basic message
        const result = await sendBasicNotification(eventName, payload, businessId);
        results.push({ ruleId: rule.id, status: result.success ? 'sent' : 'failed', ...result });
      }
    } catch (error) {
      console.error(`[NotificationEngine] Rule ${rule.id} failed:`, error.message);
      results.push({ ruleId: rule.id, status: 'error', error: error.message });
    }
  }

  return results;
};

const checkConditions = (conditions, payload) => {
  for (const [key, expectedValue] of Object.entries(conditions)) {
    const actualValue = payload[key];
    if (actualValue !== expectedValue) return false;
  }
  return true;
};

// ============================================
// SEND WHATSAPP NOTIFICATION
// ============================================
const sendWhatsAppNotification = async (templateId, payload, businessId, eventName) => {
  const templateResult = await query(
    `SELECT * FROM message_templates WHERE id = $1 AND business_id = $2 AND template_status IN ('APPROVED', 'DRAFT')`,
    [templateId, businessId]
  );

  if (templateResult.rows.length === 0) {
    return { success: false, reason: 'template_not_found' };
  }

  const template = templateResult.rows[0];

  // Build context from payload
  const context = buildContext(payload, businessId);
  const renderedBody = renderTemplate(template.body, context);

  // Check customer preferences
  const customerId = payload.customerId || payload.customer_id;
  if (customerId) {
    const prefResult = await query(
      `SELECT * FROM customer_notification_preferences WHERE customer_id = $1 AND business_id = $2`,
      [customerId, businessId]
    );
    const prefs = prefResult.rows[0];
    if (prefs) {
      if (eventName.startsWith('ORDER_') && !prefs.order_updates) {
        return { success: false, reason: 'customer_opted_out' };
      }
      if (eventName.startsWith('PAYMENT_') && !prefs.payment_updates) {
        return { success: false, reason: 'customer_opted_out' };
      }
      if (eventName.startsWith('DELIVERY_') && !prefs.delivery_updates) {
        return { success: false, reason: 'customer_opted_out' };
      }
    }
  }

  // Idempotency check
  const idempotencyKey = `${businessId}_${eventName}_${payload.orderId || payload.order_id || payload.id}_${templateId}`;
  const existingResult = await query(
    `SELECT 1 FROM notification_logs WHERE idempotency_key = $1 AND status IN ('SENT', 'DELIVERED', 'QUEUED')`,
    [idempotencyKey]
  );
  if (existingResult.rows.length > 0) {
    return { success: false, reason: 'already_sent' };
  }

  // Get customer phone
  const phone = payload.customerPhone || payload.phone;
  if (!phone) {
    // Try to get from customer record
    if (customerId) {
      const custResult = await query(`SELECT phone FROM customers WHERE id = $1`, [customerId]);
      if (custResult.rows.length > 0) {
        payload.customerPhone = custResult.rows[0].phone;
      }
    }
  }

  if (!payload.customerPhone) {
    return { success: false, reason: 'no_phone' };
  }

  try {
    const sendResult = await whatsappApi.sendText(
      businessId,
      payload.customerPhone,
      renderedBody,
      { customerId }
    );

    // Log success
    await query(
      `INSERT INTO notification_logs (business_id, customer_id, order_id, template_id, event, channel, status, provider_message_id, rendered_body, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, 'whatsapp', 'SENT', $6, $7, $8)`,
      [businessId, customerId, payload.orderId || payload.order_id || null, templateId, eventName, sendResult.messageId, renderedBody, idempotencyKey]
    );

    return { success: true, messageId: sendResult.messageId };
  } catch (error) {
    // Log failure
    await query(
      `INSERT INTO notification_logs (business_id, customer_id, order_id, template_id, event, channel, status, error, rendered_body, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, 'whatsapp', 'FAILED', $6, $7, $8)`,
      [businessId, customerId, payload.orderId || payload.order_id || null, templateId, eventName, error.message, renderedBody, idempotencyKey]
    );

    return { success: false, reason: 'send_failed', error: error.message };
  }
};

const sendBasicNotification = async (eventName, payload, businessId) => {
  const messages = {
    'ORDER_CONFIRMED': 'Your order has been confirmed!',
    'ORDER_SHIPPED': 'Your order has been shipped!',
    'ORDER_DELIVERED': 'Your order has been delivered!',
    'PAYMENT_PAID': 'Payment received. Thank you!',
    'PAYMENT_FAILED': 'Payment failed. Please try again.',
  };

  const message = messages[eventName] || 'Update from our store.';
  const phone = payload.customerPhone || payload.phone;

  if (!phone) return { success: false, reason: 'no_phone' };

  try {
    const result = await whatsappApi.sendText(businessId, phone, message);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const buildContext = async (payload, businessId) => {
  const bizResult = await query(`SELECT name FROM businesses WHERE id = $1`, [businessId]);
  const businessName = bizResult.rows[0]?.name || 'Our Store';

  return {
    customer_name: payload.customerName || 'Customer',
    business_name: businessName,
    order_number: payload.orderNumber || payload.order_number || '',
    order_total: payload.orderTotal || payload.total_amount || '',
    currency: payload.currency || 'MYR',
    payment_status: payload.paymentStatus || '',
    order_status: payload.orderStatus || '',
    delivery_status: payload.deliveryStatus || '',
    tracking_number: payload.trackingNumber || '',
    courier_name: payload.courierName || '',
    product_name: payload.productName || '',
    staff_name: payload.staffName || ''
  };
};

// ============================================
// TEMPLATE MANAGEMENT
// ============================================
export const getTemplates = async (businessId) => {
  const result = await query(
    `SELECT * FROM message_templates WHERE business_id = $1 ORDER BY name`,
    [businessId]
  );
  return result.rows;
};

export const getTemplateById = async (id, businessId) => {
  const result = await query(
    `SELECT * FROM message_templates WHERE id = $1 AND business_id = $2`,
    [id, businessId]
  );
  return result.rows[0] || null;
};

export const createTemplate = async (data, businessId) => {
  const result = await query(
    `INSERT INTO message_templates (business_id, name, category, body, variables, template_category, language_code, template_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [businessId, data.name, data.category || 'general', data.body, JSON.stringify(data.variables || []),
     data.template_category || 'UTILITY', data.language_code || 'en', data.template_status || 'DRAFT']
  );
  return result.rows[0];
};

export const updateTemplate = async (id, data, businessId) => {
  const fields = [];
  const values = [];
  let idx = 1;

  const allowed = ['name', 'category', 'body', 'variables', 'template_category', 'language_code', 'template_status', 'provider_template_name'];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      values.push(key === 'variables' ? JSON.stringify(data[key]) : data[key]);
      idx++;
    }
  }

  if (fields.length === 0) throw new Error('No valid fields to update.');

  values.push(id, businessId);
  const result = await query(
    `UPDATE message_templates SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} AND business_id = $${idx + 1} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteTemplate = async (id, businessId) => {
  const result = await query(
    `DELETE FROM message_templates WHERE id = $1 AND business_id = $2 RETURNING id`,
    [id, businessId]
  );
  return result.rows.length > 0;
};

// ============================================
// AUTOMATION RULES
// ============================================
export const getAutomationRules = async (businessId) => {
  const result = await query(
    `SELECT ar.*, mt.name as template_name FROM automation_rules ar
     LEFT JOIN message_templates mt ON ar.template_id = mt.id
     WHERE ar.business_id = $1 ORDER BY ar.created_at DESC`,
    [businessId]
  );
  return result.rows;
};

export const getAutomationRuleById = async (id, businessId) => {
  const result = await query(
    `SELECT * FROM automation_rules WHERE id = $1 AND business_id = $2`,
    [id, businessId]
  );
  return result.rows[0] || null;
};

export const createAutomationRule = async (data, businessId, userId) => {
  const result = await query(
    `INSERT INTO automation_rules (business_id, name, event, enabled, conditions, action, template_id, delay_minutes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [businessId, data.name, data.event, data.enabled !== false, JSON.stringify(data.conditions || {}),
     data.action, data.template_id || null, data.delay_minutes || 0, userId]
  );
  return result.rows[0];
};

export const updateAutomationRule = async (id, data, businessId) => {
  const fields = [];
  const values = [];
  let idx = 1;

  const allowed = ['name', 'event', 'enabled', 'conditions', 'action', 'template_id', 'delay_minutes'];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      values.push(key === 'conditions' ? JSON.stringify(data[key]) : data[key]);
      idx++;
    }
  }

  if (fields.length === 0) throw new Error('No valid fields to update.');

  values.push(id, businessId);
  const result = await query(
    `UPDATE automation_rules SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} AND business_id = $${idx + 1} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const deleteAutomationRule = async (id, businessId) => {
  const result = await query(
    `DELETE FROM automation_rules WHERE id = $1 AND business_id = $2 RETURNING id`,
    [id, businessId]
  );
  return result.rows.length > 0;
};

// ============================================
// NOTIFICATION LOGS
// ============================================
export const getNotificationLogs = async (filters = {}, businessId) => {
  let sql = `SELECT nl.*, c.full_name as customer_name, o.order_number
             FROM notification_logs nl
             LEFT JOIN customers c ON nl.customer_id = c.id
             LEFT JOIN orders o ON nl.order_id = o.id
             WHERE nl.business_id = $1`;
  const params = [businessId];
  let idx = 2;

  if (filters.status) { sql += ` AND nl.status = $${idx}`; params.push(filters.status); idx++; }
  if (filters.event) { sql += ` AND nl.event = $${idx}`; params.push(filters.event); idx++; }
  if (filters.customerId) { sql += ` AND nl.customer_id = $${idx}`; params.push(filters.customerId); idx++; }

  sql += ` ORDER BY nl.created_at DESC LIMIT 200`;
  const result = await query(sql, params);
  return result.rows;
};

// ============================================
// CUSTOMER PREFERENCES
// ============================================
export const getCustomerPreferences = async (customerId, businessId) => {
  const result = await query(
    `SELECT * FROM customer_notification_preferences WHERE customer_id = $1 AND business_id = $2`,
    [customerId, businessId]
  );
  if (result.rows.length > 0) return result.rows[0];

  const insertResult = await query(
    `INSERT INTO customer_notification_preferences (customer_id, business_id)
     VALUES ($1, $2) RETURNING *`,
    [customerId, businessId]
  );
  return insertResult.rows[0];
};

export const updateCustomerPreferences = async (customerId, businessId, data) => {
  const fields = [];
  const values = [];
  let idx = 1;

  const allowed = ['order_updates', 'payment_updates', 'delivery_updates', 'promotional_messages'];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      values.push(data[key]);
      idx++;
    }
  }

  if (fields.length === 0) throw new Error('No valid fields to update.');

  values.push(customerId, businessId);
  const result = await query(
    `UPDATE customer_notification_preferences SET ${fields.join(', ')}, updated_at = NOW()
     WHERE customer_id = $${idx} AND business_id = $${idx + 1} RETURNING *`,
    values
  );
  return result.rows[0];
};

// ============================================
// LOW STOCK ALERT
// ============================================
export const checkLowStock = async (productId, businessId) => {
  const productResult = await query(
    `SELECT name, stock_quantity, low_stock_threshold FROM products WHERE id = $1 AND business_id = $2`,
    [productId, businessId]
  );
  if (productResult.rows.length === 0) return null;

  const product = productResult.rows[0];
  const threshold = product.low_stock_threshold || 5;

  if (product.stock_quantity <= threshold) {
    return {
      alert: true,
      productName: product.name,
      stockQuantity: product.stock_quantity,
      threshold
    };
  }
  return { alert: false };
};
