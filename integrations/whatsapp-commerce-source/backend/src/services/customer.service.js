import { query } from '../database/connection.js';

export const getAllCustomers = async (filters = {}, businessId) => {
  let sql = `SELECT * FROM customers WHERE business_id = $1`;
  const params = [businessId];
  let idx = 2;
  if (filters.search) { sql += ` AND (full_name ILIKE $${idx} OR phone ILIKE $${idx} OR email ILIKE $${idx})`; params.push(`%${filters.search}%`); idx++; }
  if (filters.isActive !== undefined) { sql += ` AND is_active = $${idx}`; params.push(filters.isActive); idx++; }
  sql += ` ORDER BY created_at DESC`;
  const result = await query(sql, params);
  return result.rows;
};

export const getCustomerById = async (id, businessId) => {
  const result = await query(`SELECT * FROM customers WHERE id = $1 AND business_id = $2`, [id, businessId]);
  return result.rows[0] || null;
};

export const getCustomerByPhone = async (phone, businessId) => {
  const result = await query(`SELECT * FROM customers WHERE phone = $1 AND business_id = $2`, [phone, businessId]);
  return result.rows[0] || null;
};

export const createCustomer = async (data, businessId) => {
  const result = await query(
    `INSERT INTO customers (phone, whatsapp_id, full_name, email, address, city, country, notes, tags, business_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [data.phone, data.whatsappId || null, data.fullName || null, data.email || null,
     data.address || null, data.city || null, data.country || 'Malaysia', data.notes || null, data.tags || [], businessId]
  );
  return result.rows[0];
};

export const updateCustomer = async (id, data, businessId) => {
  const result = await query(
    `UPDATE customers SET phone = $1, whatsapp_id = $2, full_name = $3, email = $4,
     address = $5, city = $6, country = $7, notes = $8, tags = $9, is_active = $10
     WHERE id = $11 AND business_id = $12 RETURNING *`,
    [data.phone, data.whatsappId || null, data.fullName || null, data.email || null,
     data.address || null, data.city || null, data.country || 'Malaysia', data.notes || null,
     data.tags || [], data.isActive !== undefined ? data.isActive : true, id, businessId]
  );
  return result.rows[0] || null;
};

export const deleteCustomer = async (id, businessId) => {
  const result = await query(`DELETE FROM customers WHERE id = $1 AND business_id = $2 RETURNING id`, [id, businessId]);
  return result.rowCount > 0;
};

export const updateCustomerStats = async (id, orderTotal, businessId) => {
  await query(
    `UPDATE customers SET total_orders = total_orders + 1, total_spent = total_spent + $1
     WHERE id = $2 AND business_id = $3`,
    [orderTotal, id, businessId]
  );
};
