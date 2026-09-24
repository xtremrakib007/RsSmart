import { query, getPool } from '../database/connection.js';

// ============================================
// PAYMENT PROVIDER INTERFACE
// ============================================
class PaymentProvider {
  async createPayment(payment, config) { throw new Error('Not implemented'); }
  async verifyWebhook(payload, signature, config) { throw new Error('Not implemented'); }
  async processWebhook(payload, payment) { throw new Error('Not implemented'); }
  async refund(payment, amount, config) { throw new Error('Not implemented'); }
}

// Mock/Test Provider for development
class TestProvider extends PaymentProvider {
  async createPayment(payment, config) {
    const checkoutUrl = `${config.baseUrl || 'http://localhost:5000'}/api/payments/test-checkout/${payment.id}`;
    return {
      success: true,
      providerTransactionId: `test_${payment.id}`,
      checkoutUrl,
      status: 'PENDING'
    };
  }

  async verifyWebhook(payload, signature, config) {
    return true; // Test provider accepts all
  }

  async processWebhook(payload, payment) {
    const event = payload.event || payload.type;
    if (event === 'payment.success' || event === 'success') {
      return { status: 'PAID', providerTransactionId: payload.transactionId || payment.provider_transaction_id };
    }
    if (event === 'payment.failed' || event === 'failed') {
      return { status: 'FAILED', failureReason: payload.reason || 'Payment failed' };
    }
    if (event === 'payment.expired' || event === 'expired') {
      return { status: 'EXPIRED', failureReason: 'Payment expired' };
    }
    return null;
  }

  async refund(payment, amount, config) {
    return {
      success: true,
      providerRefundId: `refund_${Date.now()}`,
      amount,
      status: 'COMPLETED'
    };
  }
}

// Provider registry
const providers = {
  test: new TestProvider(),
  // malaysia_gateway: new MalaysiaGatewayProvider(), // Future
  // bangladesh_gateway: new BangladeshGatewayProvider(), // Future
};

const getProvider = (name) => {
  return providers[name] || providers.test;
};

// ============================================
// CORE PAYMENT SERVICE
// ============================================

export const createPayment = async ({ businessId, orderId, customerId, provider = 'test', amount, currency, paymentMethod, metadata = {} }) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify order belongs to business
    const orderCheck = await client.query(
      `SELECT id, total_amount, currency, status FROM orders WHERE id = $1 AND business_id = $2`,
      [orderId, businessId]
    );
    if (orderCheck.rows.length === 0) {
      throw new Error('Order not found in this business.');
    }

    const order = orderCheck.rows[0];

    // Use order amount if not specified (NEVER trust frontend amount blindly)
    const paymentAmount = amount !== undefined ? amount : order.total_amount;
    const paymentCurrency = currency || order.currency || 'MYR';

    // Check for existing active payment
    const existing = await client.query(
      `SELECT id, status FROM payments WHERE order_id = $1 AND status IN ('PENDING', 'PAID')`,
      [orderId]
    );
    if (existing.rows.length > 0 && existing.rows[0].status === 'PAID') {
      throw new Error('Order is already paid.');
    }

    // Create payment record
    const paymentResult = await client.query(
      `INSERT INTO payments (business_id, order_id, customer_id, provider, amount, currency, status, payment_method, metadata, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, $8, NOW() + INTERVAL '24 hours')
       RETURNING *`,
      [businessId, orderId, customerId, provider, paymentAmount, paymentCurrency, paymentMethod, JSON.stringify(metadata)]
    );
    const payment = paymentResult.rows[0];

    // Call provider
    const providerInstance = getProvider(provider);
    const providerConfig = await getProviderConfig(businessId, provider);
    const providerResult = await providerInstance.createPayment(payment, providerConfig);

    if (providerResult.success) {
      await client.query(
        `UPDATE payments SET provider_transaction_id = $1, provider_checkout_url = $2 WHERE id = $3`,
        [providerResult.providerTransactionId, providerResult.checkoutUrl, payment.id]
      );
      payment.provider_transaction_id = providerResult.providerTransactionId;
      payment.provider_checkout_url = providerResult.checkoutUrl;
    }

    await client.query('COMMIT');
    return payment;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const getPaymentById = async (id, businessId) => {
  const result = await query(
    `SELECT p.*, o.order_number, c.full_name as customer_name, c.phone as customer_phone
     FROM payments p
     LEFT JOIN orders o ON p.order_id = o.id
     LEFT JOIN customers c ON p.customer_id = c.id
     WHERE p.id = $1 AND p.business_id = $2`,
    [id, businessId]
  );
  return result.rows[0] || null;
};

export const getPaymentsByOrder = async (orderId, businessId) => {
  const result = await query(
    `SELECT * FROM payments WHERE order_id = $1 AND business_id = $2 ORDER BY created_at DESC`,
    [orderId, businessId]
  );
  return result.rows;
};

export const getAllPayments = async (filters = {}, businessId) => {
  let sql = `SELECT p.*, o.order_number, c.full_name as customer_name
             FROM payments p
             LEFT JOIN orders o ON p.order_id = o.id
             LEFT JOIN customers c ON p.customer_id = c.id
             WHERE p.business_id = $1`;
  const params = [businessId];
  let idx = 2;

  if (filters.status) { sql += ` AND p.status = $${idx}`; params.push(filters.status); idx++; }
  if (filters.provider) { sql += ` AND p.provider = $${idx}`; params.push(filters.provider); idx++; }
  if (filters.customerId) { sql += ` AND p.customer_id = $${idx}`; params.push(filters.customerId); idx++; }
  if (filters.orderId) { sql += ` AND p.order_id = $${idx}`; params.push(filters.orderId); idx++; }
  if (filters.search) { sql += ` AND (c.full_name ILIKE $${idx} OR o.order_number ILIKE $${idx})`; params.push(`%${filters.search}%`); idx++; }

  sql += ` ORDER BY p.created_at DESC`;
  const result = await query(sql, params);
  return result.rows;
};

export const handleWebhook = async (provider, payload, signature = null) => {
  const providerInstance = getProvider(provider);

  // For test provider, skip signature verification
  if (provider !== 'test' && signature) {
    // TODO: Verify webhook signature per provider spec
  }

  // Extract identifiers from payload
  const transactionId = payload.transactionId || payload.provider_transaction_id || payload.id;
  const eventId = payload.eventId || payload.idempotency_key || `${provider}_${transactionId}_${payload.event || payload.type}`;

  // Idempotency check
  const existingEvent = await query(
    `SELECT 1 FROM payment_webhook_events WHERE event_id = $1`,
    [eventId]
  );
  if (existingEvent.rows.length > 0) {
    return { processed: false, reason: 'duplicate_event' };
  }

  // Find payment by transaction ID
  const paymentResult = await query(
    `SELECT * FROM payments WHERE provider_transaction_id = $1 AND provider = $2`,
    [transactionId, provider]
  );

  if (paymentResult.rows.length === 0) {
    // Store event anyway for audit
    await query(
      `INSERT INTO payment_webhook_events (provider, event_id, event_type, payload) VALUES ($1, $2, $3, $4)`,
      [provider, eventId, payload.event || payload.type || 'unknown', JSON.stringify(payload)]
    );
    return { processed: false, reason: 'payment_not_found' };
  }

  const payment = paymentResult.rows[0];

  // Process webhook
  const result = await providerInstance.processWebhook(payload, payment);

  if (!result) {
    await query(
      `INSERT INTO payment_webhook_events (business_id, provider, event_id, event_type, payload) VALUES ($1, $2, $3, $4, $5)`,
      [payment.business_id, provider, eventId, payload.event || 'unknown', JSON.stringify(payload)]
    );
    return { processed: false, reason: 'unhandled_event' };
  }

  // Update payment status
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Re-verify payment exists and is in a valid state
    const currentPayment = await client.query(
      `SELECT status FROM payments WHERE id = $1 FOR UPDATE`,
      [payment.id]
    );

    if (currentPayment.rows.length === 0) {
      throw new Error('Payment not found during update.');
    }

    const oldStatus = currentPayment.rows[0].status;

    // Don't update if already in a terminal state (except for specific transitions)
    if (oldStatus === 'PAID' && result.status !== 'REFUNDED') {
      await client.query('COMMIT');
      return { processed: true, reason: 'already_paid' };
    }

    await client.query(
      `UPDATE payments SET status = $1, failure_reason = $2, paid_at = CASE WHEN $1 = 'PAID' THEN NOW() ELSE paid_at END, updated_at = NOW() WHERE id = $3`,
      [result.status, result.failureReason || null, payment.id]
    );

    // Audit log
    await client.query(
      `INSERT INTO payment_audit_log (business_id, payment_id, action, old_status, new_status, metadata)
       VALUES ($1, $2, 'webhook_status_update', $3, $4, $5)`,
      [payment.business_id, payment.id, oldStatus, result.status, JSON.stringify(payload)]
    );

    // Update order status if payment is successful
    if (result.status === 'PAID') {
      await client.query(
        `UPDATE orders SET status = 'confirmed', updated_at = NOW() WHERE id = $1`,
        [payment.order_id]
      );
      // Order status history
      await client.query(
        `INSERT INTO order_status_history (order_id, old_status, new_status, notes)
         VALUES ($1, 'pending', 'confirmed', 'Payment received via webhook')`,
        [payment.order_id]
      );
    }

    // Store webhook event
    await client.query(
      `INSERT INTO payment_webhook_events (business_id, provider, event_id, event_type, payload) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (event_id) DO NOTHING`,
      [payment.business_id, provider, eventId, payload.event || 'unknown', JSON.stringify(payload)]
    );

    await client.query('COMMIT');
    return { processed: true, paymentId: payment.id, newStatus: result.status };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const refundPayment = async (paymentId, amount, reason, userId, businessId) => {
  const payment = await getPaymentById(paymentId, businessId);
  if (!payment) throw new Error('Payment not found.');
  if (payment.status !== 'PAID') throw new Error('Only paid payments can be refunded.');

  const refundAmount = amount !== undefined ? amount : payment.amount;
  if (parseFloat(refundAmount) > parseFloat(payment.amount)) {
    throw new Error('Refund amount cannot exceed payment amount.');
  }

  const providerInstance = getProvider(payment.provider);
  const providerConfig = await getProviderConfig(businessId, payment.provider);
  const result = await providerInstance.refund(payment, refundAmount, providerConfig);

  if (result.success) {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO payment_refunds (business_id, payment_id, provider_refund_id, amount, currency, status, reason, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [businessId, paymentId, result.providerRefundId, refundAmount, payment.currency, result.status, reason, userId]
      );

      // Update payment status
      const newStatus = parseFloat(refundAmount) === parseFloat(payment.amount) ? 'REFUNDED' : 'PARTIALLY_PAID';
      await client.query(
        `UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2`,
        [newStatus, paymentId]
      );

      await client.query(
        `INSERT INTO payment_audit_log (business_id, payment_id, action, old_status, new_status, metadata, created_by)
         VALUES ($1, $2, 'refund', $3, $4, $5, $6)`,
        [businessId, paymentId, payment.status, newStatus, JSON.stringify({ refundAmount, reason }), userId]
      );

      await client.query('COMMIT');
      return { success: true, refundId: result.providerRefundId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  throw new Error('Refund failed.');
};

// ============================================
// HELPERS
// ============================================
const getProviderConfig = async (businessId, provider) => {
  const result = await query(
    `SELECT value FROM settings WHERE business_id = $1 AND key = $2`,
    [businessId, `payment_${provider}_config`]
  );
  if (result.rows.length > 0) {
    try { return JSON.parse(result.rows[0].value); } catch { return {}; }
  }
  return {};
};

export const getPaymentStats = async (businessId) => {
  const result = await query(
    `SELECT 
      COUNT(*) FILTER (WHERE status = 'PAID') as paid_count,
      COUNT(*) FILTER (WHERE status = 'PENDING') as pending_count,
      COUNT(*) FILTER (WHERE status = 'FAILED') as failed_count,
      COUNT(*) FILTER (WHERE status = 'REFUNDED') as refunded_count,
      COALESCE(SUM(amount) FILTER (WHERE status = 'PAID'), 0) as total_paid,
      COALESCE(SUM(amount) FILTER (WHERE status = 'PENDING'), 0) as total_pending
     FROM payments WHERE business_id = $1`,
    [businessId]
  );
  return result.rows[0];
};
