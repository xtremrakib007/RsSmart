import { query } from '../database/connection.js';

export const getAllProducts = async (filters = {}, businessId) => {
  let sql = `SELECT p.*, c.name as category_name FROM products p
             LEFT JOIN categories c ON p.category_id = c.id WHERE p.business_id = $1`;
  const params = [businessId];
  let idx = 2;
  if (filters.search) { sql += ` AND (p.name ILIKE $${idx} OR p.sku ILIKE $${idx})`; params.push(`%${filters.search}%`); idx++; }
  if (filters.categoryId) { sql += ` AND p.category_id = $${idx}`; params.push(filters.categoryId); idx++; }
  if (filters.isActive !== undefined) { sql += ` AND p.is_active = $${idx}`; params.push(filters.isActive); idx++; }
  sql += ` ORDER BY p.created_at DESC`;
  const result = await query(sql, params);
  return result.rows;
};

export const getProductById = async (id, businessId) => {
  const result = await query(
    `SELECT p.*, c.name as category_name FROM products p
     LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = $1 AND p.business_id = $2`,
    [id, businessId]
  );
  return result.rows[0] || null;
};

export const createProduct = async (data, businessId) => {
  const result = await query(
    `INSERT INTO products (name, description, sku, price, cost, stock_quantity, low_stock_threshold, category_id, image_url, business_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [data.name, data.description || null, data.sku || null, data.price || 0, data.cost || 0,
     data.stockQuantity || 0, data.lowStockThreshold || 10, data.categoryId || null, data.imageUrl || null, businessId]
  );
  return result.rows[0];
};

export const updateProduct = async (id, data, businessId) => {
  const result = await query(
    `UPDATE products SET name = $1, description = $2, sku = $3, price = $4, cost = $5,
     stock_quantity = $6, low_stock_threshold = $7, category_id = $8, image_url = $9, is_active = $10
     WHERE id = $11 AND business_id = $12 RETURNING *`,
    [data.name, data.description || null, data.sku || null, data.price || 0, data.cost || 0,
     data.stockQuantity || 0, data.lowStockThreshold || 10, data.categoryId || null, data.imageUrl || null,
     data.isActive !== undefined ? data.isActive : true, id, businessId]
  );
  return result.rows[0] || null;
};

export const deleteProduct = async (id, businessId) => {
  const result = await query(
    `DELETE FROM products WHERE id = $1 AND business_id = $2 RETURNING id`,
    [id, businessId]
  );
  return result.rowCount > 0;
};

export const getLowStockProducts = async (businessId) => {
  const result = await query(
    `SELECT * FROM products WHERE business_id = $1 AND stock_quantity <= low_stock_threshold
     AND is_active = true ORDER BY stock_quantity ASC`,
    [businessId]
  );
  return result.rows;
};
