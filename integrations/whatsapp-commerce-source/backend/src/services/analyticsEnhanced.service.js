import { query } from '../database/connection.js';

const DATE_RANGES = {
  today: `DATE(created_at) = CURRENT_DATE`,
  yesterday: `DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'`,
  '7days': `created_at >= NOW() - INTERVAL '7 days'`,
  '30days': `created_at >= NOW() - INTERVAL '30 days'`,
  this_month: `created_at >= DATE_TRUNC('month', NOW())`,
  last_month: `created_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month') AND created_at < DATE_TRUNC('month', NOW())`,
};

const getDateFilter = (range, tableAlias = '') => {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  if (range === 'custom' || !DATE_RANGES[range]) return null;
  return DATE_RANGES[range].replace(/created_at/g, `${prefix}created_at`);
};

export const getDashboardMetrics = async (range, businessId) => {
  const dateFilter = getDateFilter(range);
  const dateFilterOrders = dateFilter ? `AND ${dateFilter}` : '';
  const dateFilterCustomers = dateFilter ? `AND ${dateFilter.replace(/orders/g, 'customers')}` : '';

  const result = await query(
    `SELECT
      (SELECT COUNT(*) FROM orders WHERE business_id = $1 ${dateFilterOrders} AND status != 'cancelled') as orders_count,
      (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE business_id = $1 ${dateFilterOrders} AND status != 'cancelled') as sales_total,
      (SELECT COUNT(DISTINCT customer_id) FROM orders WHERE business_id = $1 ${dateFilterOrders} AND status != 'cancelled') as customers_ordered,
      (SELECT COUNT(*) FROM customers WHERE business_id = $1 ${dateFilterCustomers}) as customers_new,
      (SELECT COUNT(*) FROM orders WHERE business_id = $1 AND status = 'pending') as pending_orders,
      (SELECT COUNT(*) FROM payments WHERE business_id = $1 AND status = 'pending') as pending_payments,
      (SELECT COUNT(*) FROM deliveries WHERE business_id = $1 AND status = 'pending') as pending_deliveries,
      (SELECT COUNT(*) FROM whatsapp_conversations WHERE business_id = $1 ${dateFilterCustomers.replace(/customers/g, 'whatsapp_conversations')}) as whatsapp_conversations,
      (SELECT COUNT(*) FROM orders WHERE business_id = $1 ${dateFilterOrders} AND source = 'whatsapp' AND status != 'cancelled') as whatsapp_orders,
      (SELECT COALESCE(AVG(total_amount), 0) FROM orders WHERE business_id = $1 ${dateFilterOrders} AND status != 'cancelled') as avg_order_value,
      (SELECT COUNT(*) FROM customers WHERE business_id = $1 AND total_orders >= 2) as repeat_customers,
      (SELECT COUNT(*) FROM products WHERE business_id = $1 AND stock_quantity <= low_stock_threshold) as low_stock_count`,
    [businessId]
  );
  return result.rows[0];
};

export const getSalesOverTime = async (range, businessId) => {
  const interval = range === 'today' || range === 'yesterday' ? 'hour' : 'day';
  const dateFilter = getDateFilter(range);
  const where = `business_id = $1 AND status != 'cancelled' ${dateFilter ? `AND ${dateFilter}` : ''}`;

  const result = await query(
    `SELECT DATE_TRUNC('${interval}', created_at) as period,
      COUNT(*) as orders,
      COALESCE(SUM(total_amount), 0) as revenue,
      COALESCE(SUM(subtotal), 0) as subtotal,
      COALESCE(SUM(discount_amount), 0) as discounts,
      COALESCE(SUM(shipping_amount), 0) as shipping
     FROM orders WHERE ${where}
     GROUP BY period ORDER BY period ASC`,
    [businessId]
  );
  return result.rows;
};

export const getOrdersOverTime = async (range, businessId) => {
  const interval = range === 'today' || range === 'yesterday' ? 'hour' : 'day';
  const dateFilter = getDateFilter(range);
  const where = `business_id = $1 ${dateFilter ? `AND ${dateFilter}` : ''}`;

  const result = await query(
    `SELECT DATE_TRUNC('${interval}', created_at) as period,
      COUNT(*) FILTER (WHERE status != 'cancelled') as completed,
      COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
      COUNT(*) FILTER (WHERE status = 'pending') as pending
     FROM orders WHERE ${where}
     GROUP BY period ORDER BY period ASC`,
    [businessId]
  );
  return result.rows;
};

export const getCustomerAnalytics = async (range, businessId) => {
  const dateFilter = getDateFilter(range, 'c');
  const where = `c.business_id = $1 ${dateFilter ? `AND ${dateFilter}` : ''}`;

  const result = await query(
    `SELECT
      COUNT(*) FILTER (WHERE c.total_orders = 0 OR c.total_orders IS NULL) as new_customers,
      COUNT(*) FILTER (WHERE c.total_orders >= 2) as returning_customers,
      COUNT(*) FILTER (WHERE c.customer_type = 'b2b') as b2b_customers,
      COUNT(*) FILTER (WHERE c.last_order_at < NOW() - INTERVAL '90 days') as inactive_customers,
      COALESCE(AVG(c.total_spent), 0) as avg_lifetime_value,
      COALESCE(AVG(c.total_orders), 0) as avg_order_count
     FROM customers c WHERE ${where}`,
    [businessId]
  );
  return result.rows[0];
};

export const getTopCustomers = async (limit, businessId) => {
  const result = await query(
    `SELECT id, full_name, phone, total_orders, total_spent, last_order_at
     FROM customers WHERE business_id = $1
     ORDER BY total_spent DESC LIMIT $2`,
    [businessId, limit || 10]
  );
  return result.rows;
};

export const getProductAnalytics = async (range, businessId) => {
  const dateFilter = getDateFilter(range, 'o');
  const where = `p.business_id = $1 AND o.status != 'cancelled' ${dateFilter ? `AND ${dateFilter}` : ''}`;

  const result = await query(
    `SELECT p.id, p.name, p.sku, p.stock_quantity, p.low_stock_threshold,
      COALESCE(SUM(oi.quantity), 0) as quantity_sold,
      COALESCE(SUM(oi.total_price), 0) as revenue,
      COUNT(DISTINCT o.id) as order_count,
      COUNT(DISTINCT o.id) FILTER (WHERE c.customer_type = 'b2b') as b2b_orders,
      COUNT(DISTINCT o.id) FILTER (WHERE c.customer_type = 'b2c') as b2c_orders
     FROM products p
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN orders o ON oi.order_id = o.id
     LEFT JOIN customers c ON o.customer_id = c.id
     WHERE ${where}
     GROUP BY p.id, p.name, p.sku, p.stock_quantity, p.low_stock_threshold
     ORDER BY quantity_sold DESC`,
    [businessId]
  );
  return result.rows;
};

export const getPaymentStatusBreakdown = async (range, businessId) => {
  const dateFilter = getDateFilter(range);
  const where = `business_id = $1 ${dateFilter ? `AND ${dateFilter}` : ''}`;

  const result = await query(
    `SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
     FROM payments WHERE ${where}
     GROUP BY status ORDER BY count DESC`,
    [businessId]
  );
  return result.rows;
};

export const getDeliveryStatusBreakdown = async (range, businessId) => {
  const dateFilter = getDateFilter(range);
  const where = `business_id = $1 ${dateFilter ? `AND ${dateFilter}` : ''}`;

  const result = await query(
    `SELECT status, COUNT(*) as count
     FROM deliveries WHERE ${where}
     GROUP BY status ORDER BY count DESC`,
    [businessId]
  );
  return result.rows;
};

export const getB2CvsB2BSales = async (range, businessId) => {
  const dateFilter = getDateFilter(range);
  const where = `o.business_id = $1 AND o.status != 'cancelled' ${dateFilter ? `AND ${dateFilter}` : ''}`;

  const result = await query(
    `SELECT c.customer_type,
      COUNT(*) as orders,
      COALESCE(SUM(o.total_amount), 0) as revenue
     FROM orders o
     JOIN customers c ON o.customer_id = c.id
     WHERE ${where}
     GROUP BY c.customer_type`,
    [businessId]
  );
  return result.rows;
};

export const getWhatsAppAnalytics = async (range, businessId) => {
  const dateFilter = getDateFilter(range, 'm');
  const whereMessages = `m.business_id = $1 ${dateFilter ? `AND ${dateFilter}` : ''}`;

  const result = await query(
    `SELECT
      (SELECT COUNT(*) FROM whatsapp_messages m WHERE ${whereMessages} AND m.direction = 'inbound') as messages_received,
      (SELECT COUNT(*) FROM whatsapp_messages m WHERE ${whereMessages} AND m.direction = 'outbound') as messages_sent,
      (SELECT COUNT(*) FROM whatsapp_conversations WHERE business_id = $1 ${dateFilter ? `AND ${getDateFilter(range, 'whatsapp_conversations')}` : ''}) as conversations,
      (SELECT COUNT(*) FROM whatsapp_funnel_events WHERE business_id = $1 AND event_type = 'HUMAN_HANDOFF' ${dateFilter ? `AND ${getDateFilter(range, 'whatsapp_funnel_events')}` : ''}) as human_handoffs,
      (SELECT COUNT(*) FROM orders WHERE business_id = $1 AND source = 'whatsapp' ${dateFilter ? `AND ${getDateFilter(range, 'orders')}` : ''}) as whatsapp_orders,
      (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE business_id = $1 AND source = 'whatsapp' ${dateFilter ? `AND ${getDateFilter(range, 'orders')}` : ''}) as whatsapp_sales`,
    [businessId]
  );
  return result.rows[0];
};

export const getWhatsAppFunnel = async (range, businessId) => {
  const dateFilter = getDateFilter(range);
  const where = `business_id = $1 ${dateFilter ? `AND ${dateFilter}` : ''}`;

  const result = await query(
    `SELECT event_type, COUNT(*) as count
     FROM whatsapp_funnel_events
     WHERE ${where}
     GROUP BY event_type
     ORDER BY count DESC`,
    [businessId]
  );
  return result.rows;
};

export const getSalesReport = async ({ startDate, endDate }, businessId) => {
  const result = await query(
    `SELECT
      COALESCE(SUM(subtotal), 0) as gross_sales,
      COALESCE(SUM(discount_amount), 0) as discounts,
      COALESCE(SUM(shipping_amount), 0) as delivery_fees,
      COALESCE(SUM(total_amount) FILTER (WHERE status = 'cancelled'), 0) as refunds,
      COALESCE(SUM(total_amount) FILTER (WHERE status != 'cancelled'), 0) as net_sales,
      COUNT(*) FILTER (WHERE status != 'cancelled') as order_count,
      COALESCE(AVG(total_amount) FILTER (WHERE status != 'cancelled'), 0) as avg_order_value
     FROM orders
     WHERE business_id = $1 AND DATE(created_at) BETWEEN $2 AND $3`,
    [businessId, startDate, endDate]
  );
  return result.rows[0];
};

export const getSlowMovingProducts = async (businessId) => {
  const result = await query(
    `SELECT p.id, p.name, p.sku, p.stock_quantity,
      COALESCE(SUM(oi.quantity), 0) as sold_30d
     FROM products p
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN orders o ON oi.order_id = o.id AND o.created_at >= NOW() - INTERVAL '30 days' AND o.status != 'cancelled'
     WHERE p.business_id = $1 AND p.is_active = true
     GROUP BY p.id, p.name, p.sku, p.stock_quantity
     HAVING COALESCE(SUM(oi.quantity), 0) = 0
     ORDER BY p.stock_quantity DESC
     LIMIT 50`,
    [businessId]
  );
  return result.rows;
};
