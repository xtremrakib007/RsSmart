import { query, getPool } from '../database/connection.js';
import { updateCustomerStats } from './customer.service.js';
import { sendOrderStatusNotification } from './notification.service.js';
import { calculateOrderPrices, getProductPrice } from './pricing.service.js';
import { checkStockAvailability, reserveStock, restoreStock } from './inventory.service.js';

export const getAllOrders = async (filters = {}, businessId) => {
  let sql = `SELECT o.*, c.full_name as customer_name, c.phone as customer_phone,
             u.full_name as created_by_name FROM orders o
             LEFT JOIN customers c ON o.customer_id = c.id
             LEFT JOIN users u ON o.created_by = u.id WHERE o.business_id = $1`;
  const params = [businessId];
  let idx = 2;
  if (filters.status) { sql += ` AND o.status = $${idx}`; params.push(filters.status); idx++; }
  if (filters.customerId) { sql += ` AND o.customer_id = $${idx}`; params.push(filters.customerId); idx++; }
  if (filters.search) { sql += ` AND (c.full_name ILIKE $${idx} OR c.phone ILIKE $${idx})`; params.push(`%${filters.search}%`); idx++; }
  sql += ` ORDER BY o.created_at DESC`;
  const result = await query(sql, params);
  return result.rows;
};

export const getOrderById = async (id, businessId) => {
  const orderResult = await query(
    `SELECT o.*, c.full_name as customer_name, c.phone as customer_phone, c.email as customer_email,
     c.address as customer_address, c.city as customer_city, c.country as customer_country,
     u.full_name as created_by_name FROM orders o
     LEFT JOIN customers c ON o.customer_id = c.id
     LEFT JOIN users u ON o.created_by = u.id WHERE o.id = $1 AND o.business_id = $2`,
    [id, businessId]
  );
  if (orderResult.rows.length === 0) return null;
  const itemsResult = await query(
    `SELECT oi.*, p.name as product_name, p.sku as product_sku FROM order_items oi
     LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = $1`, [id]
  );
  const historyResult = await query(
    `SELECT osh.*, u.full_name as changed_by_name FROM order_status_history osh
     LEFT JOIN users u ON osh.changed_by = u.id WHERE osh.order_id = $1 ORDER BY osh.created_at DESC`, [id]
  );
  return { ...orderResult.rows[0], items: itemsResult.rows, history: historyResult.rows };
};

export const createOrder = async (data, userId, businessId) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify customer belongs to this business
    const custCheck = await client.query(
      `SELECT id, customer_type FROM customers WHERE id = $1 AND business_id = $2`,
      [data.customerId, businessId]
    );
    if (custCheck.rows.length === 0) throw new Error('Customer not found in this business.');

    // Calculate prices from database (NEVER trust frontend unitPrice)
    const { pricedItems, subtotal } = await calculateOrderPrices({
      businessId,
      customerId: data.customerId,
      items: data.items
    });

    // Check stock availability with row locking
    await checkStockAvailability(
      pricedItems.map(i => ({ productId: i.productId, quantity: i.quantity })),
      businessId
    );

    const taxAmount = data.taxAmount || 0;
    const discountAmount = data.discountAmount || 0;
    const shippingAmount = data.shippingAmount || 0;
    const totalAmount = subtotal + taxAmount - discountAmount + shippingAmount;

    const orderResult = await client.query(
      `INSERT INTO orders (customer_id, status, subtotal, tax_amount, discount_amount, shipping_amount,
       total_amount, currency, notes, delivery_address, delivery_city, delivery_country, delivery_phone,
       created_by, source, business_id)
       VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [data.customerId, subtotal, taxAmount, discountAmount, shippingAmount, totalAmount,
       data.currency || 'MYR', data.notes || null, data.deliveryAddress || null, data.deliveryCity || null,
       data.deliveryCountry || 'Malaysia', data.deliveryPhone || null, userId || null, data.source || 'web', businessId]
    );
    const order = orderResult.rows[0];

    // Insert order items with DB-calculated prices and reserve stock
    for (const item of pricedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.id, item.productId, item.productName, item.quantity, item.unitPrice, item.totalPrice]
      );

      // Reserve stock via inventory service (creates movement record)
      await reserveStock({
        productId: item.productId,
        quantity: item.quantity,
        orderId: order.id,
        userId,
        businessId
      });
    }

    await client.query(
      `INSERT INTO order_status_history (order_id, new_status, changed_by, notes) VALUES ($1, 'pending', $2, 'Order created')`,
      [order.id, userId || null]
    );

    await client.query('COMMIT');

    // Send notification (non-critical)
    try {
      const cr = await query('SELECT phone FROM customers WHERE id = $1 AND business_id = $2', [data.customerId, businessId]);
      if (cr.rows[0]?.phone) await sendOrderStatusNotification(order.id, 'pending', cr.rows[0].phone, businessId);
    } catch (e) { console.log('Notification failed:', e.message); }

    try { await updateCustomerStats(data.customerId, totalAmount, businessId); } catch (e) {}
    return order;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
};

export const updateOrderStatus = async (id, newStatus, userId, notes, businessId) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const currentResult = await client.query(
      `SELECT status, customer_id FROM orders WHERE id = $1 AND business_id = $2`, [id, businessId]
    );
    if (currentResult.rows.length === 0) { await client.query('ROLLBACK'); return null; }
    const oldStatus = currentResult.rows[0].status;
    const customerId = currentResult.rows[0].customer_id;

    const result = await client.query(
      `UPDATE orders SET status = $1 WHERE id = $2 AND business_id = $3 RETURNING *`, [newStatus, id, businessId]
    );

    await client.query(
      `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes) VALUES ($1, $2, $3, $4, $5)`,
      [id, oldStatus, newStatus, userId || null, notes]
    );

    // If cancelling, restore stock
    if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
      const itemsResult = await client.query(
        `SELECT product_id, quantity FROM order_items WHERE order_id = $1`, [id]
      );
      for (const item of itemsResult.rows) {
        await restoreStock({
          productId: item.product_id,
          quantity: item.quantity,
          orderId: id,
          userId,
          businessId
        });
      }
    }

    await client.query('COMMIT');

    try {
      const cr = await query('SELECT phone FROM customers WHERE id = $1 AND business_id = $2', [customerId, businessId]);
      if (cr.rows[0]?.phone) await sendOrderStatusNotification(id, newStatus, cr.rows[0].phone, businessId);
    } catch (e) { console.log('Status notification failed:', e.message); }

    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
};

export const deleteOrder = async (id, businessId) => {
  const result = await query(`DELETE FROM orders WHERE id = $1 AND business_id = $2 RETURNING id`, [id, businessId]);
  return result.rowCount > 0;
};

export const getOrderStats = async (businessId) => {
  const result = await query(`
    SELECT COUNT(*) as total_orders,
      COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
      COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_orders,
      COUNT(*) FILTER (WHERE status = 'processing') as processing_orders,
      COUNT(*) FILTER (WHERE status = 'shipped') as shipped_orders,
      COUNT(*) FILTER (WHERE status = 'delivered') as delivered_orders,
      COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_orders,
      COALESCE(SUM(total_amount) FILTER (WHERE status != 'cancelled'), 0) as total_revenue,
      COALESCE(SUM(total_amount) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days' AND status != 'cancelled'), 0) as revenue_30d
    FROM orders WHERE business_id = $1`, [businessId]);
  return result.rows[0];
};
