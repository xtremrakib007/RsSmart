import { query } from '../database/connection.js';

export const getAllTemplates = async (businessId) => {
  const result = await query(`SELECT * FROM message_templates WHERE business_id = $1 ORDER BY category, name`, [businessId]);
  return result.rows;
};

export const getTemplateById = async (id, businessId) => {
  const result = await query(`SELECT * FROM message_templates WHERE id = $1 AND business_id = $2`, [id, businessId]);
  return result.rows[0] || null;
};

export const getTemplateByName = async (name, businessId) => {
  const result = await query(`SELECT * FROM message_templates WHERE name = $1 AND business_id = $2`, [name, businessId]);
  return result.rows[0] || null;
};

export const createTemplate = async (data, businessId) => {
  const result = await query(
    `INSERT INTO message_templates (name, category, language, header, body, footer, variables, business_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [data.name, data.category || 'general', data.language || 'en', data.header || null,
     data.body, data.footer || null, JSON.stringify(data.variables || []), businessId]
  );
  return result.rows[0];
};

export const updateTemplate = async (id, data, businessId) => {
  const result = await query(
    `UPDATE message_templates SET name = $1, category = $2, language = $3, header = $4,
     body = $5, footer = $6, variables = $7, is_active = $8 WHERE id = $9 AND business_id = $10 RETURNING *`,
    [data.name, data.category || 'general', data.language || 'en', data.header || null, data.body,
     data.footer || null, JSON.stringify(data.variables || []), data.isActive !== undefined ? data.isActive : true, id, businessId]
  );
  return result.rows[0] || null;
};

export const deleteTemplate = async (id, businessId) => {
  const result = await query(`DELETE FROM message_templates WHERE id = $1 AND business_id = $2 RETURNING id`, [id, businessId]);
  return result.rowCount > 0;
};
