import { query } from '../database/connection.js';

export const getSalesOverview = async (days, businessId) => {
  const result = await query(`
    SELECT DATE(created_at) as date, COUNT(*) as orders,
      COALESCE(SUM(total_amount), 0) as revenue, COALESCE(SUM(subtotal), 0) as subtotal
    FROM orders WHERE status != 'cancelled' AND business_id = $1
    AND created_at >= NOW() - INTERVAL '${days || 30} days'
    GROUP BY DATE(created_at) ORDER BY date ASC`, [businessId]);
  return result.rows;
};

export const getTopProducts = async (limit, businessId) => {
  const result = await query(`
    SELECT p.id, p.name, p.sku, SUM(oi.quantity) as total_sold,
      SUM(oi.total_price) as total_revenue, COUNT(DISTINCT oi.order_id) as order_count
    FROM order_items oi JOIN products p ON oi.product_id = p.id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status != 'cancelled' AND p.business_id = $1 AND o.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY p.id, p.name, p.sku ORDER BY total_sold DESC LIMIT $2`, [businessId, limit || 5]);
  return result.rows;
};

export const getOrderStatusBreakdown = async (businessId) => {
  const result = await query(`
    SELECT status, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue
    FROM orders WHERE created_at >= NOW() - INTERVAL '30 days' AND business_id = $1
    GROUP BY status ORDER BY count DESC`, [businessId]);
  return result.rows;
};

export const getCustomerGrowth = async (days, businessId) => {
  const result = await query(`
    SELECT DATE(created_at) as date, COUNT(*) as new_customers
    FROM customers WHERE created_at >= NOW() - INTERVAL '${days || 30} days' AND business_id = $1
    GROUP BY DATE(created_at) ORDER BY date ASC`, [businessId]);
  return result.rows;
};

export const getRevenueByCategory = async (businessId) => {
  const result = await query(`
    SELECT COALESCE(c.name, 'Uncategorized') as category, COUNT(DISTINCT o.id) as orders,
      SUM(oi.total_price) as revenue, SUM(oi.quantity) as items_sold
    FROM order_items oi JOIN products p ON oi.product_id = p.id
    JOIN orders o ON oi.order_id = o.id LEFT JOIN categories c ON p.category_id = c.id
    WHERE o.status != 'cancelled' AND p.business_id = $1 AND o.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY c.name ORDER BY revenue DESC`, [businessId]);
  return result.rows;
};

export const getRecentActivity = async (limit, businessId) => {
  const result = await query(`
    SELECT o.id, o.status, o.total_amount, o.created_at, c.full_name as customer_name, c.phone as customer_phone
    FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.business_id = $1
    ORDER BY o.created_at DESC LIMIT $2`, [businessId, limit || 10]);
  return result.rows;
};

export const getDashboardSummary = async (businessId) => {
  const result = await query(`
    SELECT
      (SELECT COUNT(*) FROM orders WHERE status != 'cancelled' AND created_at >= NOW() - INTERVAL '30 days' AND business_id = $1) as orders_30d,
      (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status != 'cancelled' AND created_at >= NOW() - INTERVAL '30 days' AND business_id = $1) as revenue_30d,
      (SELECT COUNT(*) FROM customers WHERE created_at >= NOW() - INTERVAL '30 days' AND business_id = $1) as new_customers_30d,
      (SELECT COUNT(*) FROM products WHERE stock_quantity <= low_stock_threshold AND is_active = true AND business_id = $1) as low_stock_count,
      (SELECT COUNT(*) FROM orders WHERE status = 'pending' AND business_id = $1) as pending_orders,
      (SELECT COUNT(*) FROM orders WHERE status = 'shipped' AND business_id = $1) as shipped_orders`, [businessId]);
  return result.rows[0];
};
