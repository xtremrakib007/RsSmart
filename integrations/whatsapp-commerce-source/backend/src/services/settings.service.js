import { query } from '../database/connection.js';

const parseValue = (value, dataType) => {
  switch (dataType) {
    case 'number': return parseFloat(value) || 0;
    case 'boolean': return value === 'true' || value === true;
    case 'json': try { return JSON.parse(value); } catch { return {}; }
    default: return value;
  }
};

const serializeValue = (value, dataType) => {
  if (dataType === 'json') return JSON.stringify(value);
  return String(value);
};

export const getAllSettings = async (businessId, category = null) => {
  let sql = `SELECT * FROM settings WHERE business_id = $1`;
  const params = [businessId];
  if (category) { sql += ` AND category = $2`; params.push(category); }
  sql += ` ORDER BY category, key`;
  const result = await query(sql, params);
  const settings = {};
  result.rows.forEach(row => {
    settings[row.key] = { value: parseValue(row.value, row.data_type), dataType: row.data_type,
      category: row.category, description: row.description, isPublic: row.is_public };
  });
  return settings;
};

export const getSetting = async (key, businessId) => {
  const result = await query(`SELECT * FROM settings WHERE key = $1 AND business_id = $2`, [key, businessId]);
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return { value: parseValue(row.value, row.data_type), dataType: row.data_type,
    category: row.category, description: row.description, isPublic: row.is_public };
};

export const getSettingValue = async (key, businessId, defaultValue = null) => {
  const setting = await getSetting(key, businessId);
  return setting ? setting.value : defaultValue;
};

export const updateSetting = async (key, value, businessId) => {
  const dataType = await getDataType(key, businessId);
  const result = await query(
    `UPDATE settings SET value = $1 WHERE key = $2 AND business_id = $3 RETURNING *`,
    [serializeValue(value, dataType), key, businessId]
  );
  if (result.rows.length === 0) {
    const createResult = await query(
      `INSERT INTO settings (key, value, data_type, category, business_id) VALUES ($1, $2, 'string', 'general', $3) RETURNING *`,
      [key, String(value), businessId]
    );
    return createResult.rows[0];
  }
  return result.rows[0];
};

export const updateMultipleSettings = async (settingsMap, businessId) => {
  const updated = [];
  for (const [key, value] of Object.entries(settingsMap)) {
    const result = await query(
      `UPDATE settings SET value = $1 WHERE key = $2 AND business_id = $3 RETURNING *`,
      [serializeValue(value, await getDataType(key, businessId)), key, businessId]
    );
    if (result.rows.length > 0) updated.push(result.rows[0]);
  }
  return updated;
};

const getDataType = async (key, businessId) => {
  const result = await query(`SELECT data_type FROM settings WHERE key = $1 AND business_id = $2`, [key, businessId]);
  return result.rows[0]?.data_type || 'string';
};

export const getPublicSettings = async (businessId) => {
  const result = await query(
    `SELECT * FROM settings WHERE business_id = $1 AND is_public = true ORDER BY category, key`, [businessId]
  );
  const settings = {};
  result.rows.forEach(row => { settings[row.key] = parseValue(row.value, row.data_type); });
  return settings;
};
