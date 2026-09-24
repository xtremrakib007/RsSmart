import { query, getPool } from '../database/connection.js';
import { getInvoiceSettings } from './localization.service.js';

export const getInvoices = async (filters, businessId) => {
  let sql = `SELECT i.*, c.full_name as customer_name, o.order_number
             FROM invoices i
             LEFT JOIN customers c ON i.customer_id = c.id
             LEFT JOIN orders o ON i.order_id = o.id
             WHERE i.business_id = $1`;
  const params = [businessId];
  let idx = 2;
  if (filters.status) { sql += ` AND i.status = $${idx}`; params.push(filters.status); idx++; }
  if (filters.customerId) { sql += ` AND i.customer_id = $${idx}`; params.push(filters.customerId); idx++; }
  sql += ` ORDER BY i.created_at DESC`;
  const result = await query(sql, params);
  return result.rows;
};

export const getInvoiceById = async (id, businessId) => {
  const result = await query(
    `SELECT i.*, c.full_name as customer_name, c.phone as customer_phone, c.email as customer_email, o.order_number
     FROM invoices i
     LEFT JOIN customers c ON i.customer_id = c.id
     LEFT JOIN orders o ON i.order_id = o.id
     WHERE i.id = $1 AND i.business_id = $2`,
    [id, businessId]
  );
  if (result.rows.length === 0) return null;
  const invoice = result.rows[0];
  const itemsResult = await query(
    `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY created_at ASC`,
    [id]
  );
  invoice.items = itemsResult.rows;
  return invoice;
};

export const getInvoiceByNumber = async (number, businessId) => {
  const result = await query(
    `SELECT * FROM invoices WHERE invoice_number = $1 AND business_id = $2`,
    [number, businessId]
  );
  return result.rows[0] || null;
};

export const generateNextInvoiceNumber = async (businessId) => {
  const settings = await getInvoiceSettings(businessId);
  const prefix = settings.invoice_prefix || 'INV';
  const year = new Date().getFullYear();
  const nextNum = settings.next_invoice_number || 1;
  const number = `${prefix}-${year}-${String(nextNum).padStart(6, '0')}`;

  // Atomically increment
  await query(
    `UPDATE invoice_settings SET next_invoice_number = next_invoice_number + 1 WHERE business_id = $1`,
    [businessId]
  );
  return number;
};

export const createInvoiceFromOrder = async (orderId, businessId) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get order with customer snapshot
    const orderResult = await client.query(
      `SELECT o.*, c.full_name, c.email, c.phone, c.address, c.city, c.state, c.postal_code, c.country
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       WHERE o.id = $1 AND o.business_id = $2`,
      [orderId, businessId]
    );
    if (orderResult.rows.length === 0) throw new Error('Order not found.');
    const order = orderResult.rows[0];

    // Check if invoice already exists
    const existing = await client.query(
      `SELECT id FROM invoices WHERE order_id = $1 AND business_id = $2`,
      [orderId, businessId]
    );
    if (existing.rows.length > 0) {
      throw new Error('Invoice already exists for this order.');
    }

    const invoiceNumber = await generateNextInvoiceNumber(businessId);

    // Create invoice
    const invResult = await client.query(
      `INSERT INTO invoices
       (business_id, invoice_number, order_id, customer_id, customer_name, customer_email, customer_phone,
        shipping_address, shipping_city, shipping_state, shipping_postal_code, shipping_country,
        subtotal, discount_amount, tax_amount, tax_rate, shipping_amount, total_amount, currency, status, due_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'draft', $20)
       RETURNING *`,
      [businessId, invoiceNumber, orderId, order.customer_id, order.full_name, order.email, order.phone,
       order.delivery_address, order.delivery_city, order.delivery_state, null, order.delivery_country,
       order.subtotal, order.discount_amount, order.tax_amount, 0, order.shipping_amount, order.total_amount,
       order.currency, new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)]
    );
    const invoice = invResult.rows[0];

    // Copy order items to invoice items
    const itemsResult = await client.query(
      `SELECT * FROM order_items WHERE order_id = $1`,
      [orderId]
    );
    for (const item of itemsResult.rows) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, product_id, product_name, product_sku, quantity, unit_price, total_price)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [invoice.id, item.product_id, item.product_name, item.sku, item.quantity, item.unit_price, item.total_price]
      );
    }

    await client.query('COMMIT');
    return invoice;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const updateInvoiceStatus = async (id, businessId, { status, paymentStatus, paymentReference }) => {
  const sets = [];
  const params = [];
  let idx = 1;
  if (status) { sets.push(`status = $${idx}`); params.push(status); idx++; }
  if (paymentStatus) { sets.push(`payment_status = $${idx}`); params.push(paymentStatus); idx++; }
  if (paymentReference) { sets.push(`payment_reference = $${idx}`); params.push(paymentReference); idx++; }
  if (status === 'paid') { sets.push(`paid_at = NOW()`); }
  sets.push(`updated_at = NOW()`);
  params.push(id);
  params.push(businessId);
  const result = await query(
    `UPDATE invoices SET ${sets.join(', ')} WHERE id = $${idx} AND business_id = $${idx + 1} RETURNING *`,
    params
  );
  return result.rows[0] || null;
};

export const createReceipt = async ({ orderId, paymentId, customerId, customerName, amount, currency, paymentMethod, transactionReference }, businessId) => {
  const settings = await getInvoiceSettings(businessId);
  const prefix = settings.receipt_prefix || 'RCP';
  const nextNum = settings.next_receipt_number || 1;
  const receiptNumber = `${prefix}-${new Date().getFullYear()}-${String(nextNum).padStart(6, '0')}`;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO receipts (business_id, receipt_number, order_id, payment_id, customer_id, customer_name, amount, currency, payment_method, transaction_reference)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [businessId, receiptNumber, orderId, paymentId, customerId, customerName, amount, currency, paymentMethod, transactionReference]
    );
    await client.query(
      `UPDATE invoice_settings SET next_receipt_number = next_receipt_number + 1 WHERE business_id = $1`,
      [businessId]
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

export const getReceipts = async (businessId, filters = {}) => {
  let sql = `SELECT r.*, o.order_number FROM receipts r LEFT JOIN orders o ON r.order_id = o.id WHERE r.business_id = $1`;
  const params = [businessId];
  let idx = 2;
  if (filters.orderId) { sql += ` AND r.order_id = $${idx}`; params.push(filters.orderId); idx++; }
  sql += ` ORDER BY r.created_at DESC`;
  const result = await query(sql, params);
  return result.rows;
};
