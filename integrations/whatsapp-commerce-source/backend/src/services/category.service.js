import { query } from '../database/connection.js';

export const getAllCategories = async (businessId) => {
  const result = await query(
    `SELECT * FROM categories WHERE business_id = $1 ORDER BY sort_order, name`,
    [businessId]
  );
  return result.rows;
};

export const getCategoryById = async (id, businessId) => {
  const result = await query(
    `SELECT * FROM categories WHERE id = $1 AND business_id = $2`,
    [id, businessId]
  );
  return result.rows[0] || null;
};

export const createCategory = async (data, businessId) => {
  const result = await query(
    `INSERT INTO categories (name, description, image_url, sort_order, business_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [data.name, data.description || null, data.imageUrl || null, data.sortOrder || 0, businessId]
  );
  return result.rows[0];
};

export const updateCategory = async (id, data, businessId) => {
  const result = await query(
    `UPDATE categories SET name = $1, description = $2, image_url = $3, sort_order = $4, is_active = $5
     WHERE id = $6 AND business_id = $7 RETURNING *`,
    [data.name, data.description || null, data.imageUrl || null, data.sortOrder || 0,
     data.isActive !== undefined ? data.isActive : true, id, businessId]
  );
  return result.rows[0] || null;
};

export const deleteCategory = async (id, businessId) => {
  const result = await query(
    `DELETE FROM categories WHERE id = $1 AND business_id = $2 RETURNING id`,
    [id, businessId]
  );
  return result.rowCount > 0;
};
