import { query } from '../database/connection.js';

export const getAvailableProviders = async (category = null) => {
  let sql = `SELECT * FROM integration_providers WHERE is_active = true`;
  const params = [];
  if (category) { sql += ` AND category = $1`; params.push(category); }
  sql += ` ORDER BY category, name`;
  const result = await query(sql, params);
  return result.rows;
};

export const getBusinessIntegrations = async (businessId) => {
  const result = await query(
    `SELECT bi.*, ip.name as provider_name, ip.code as provider_code, ip.category, ip.description, ip.icon_url
     FROM business_integrations bi
     JOIN integration_providers ip ON bi.provider_id = ip.id
     WHERE bi.business_id = $1
     ORDER BY ip.category, ip.name`,
    [businessId]
  );
  return result.rows;
};

export const getIntegrationById = async (id, businessId) => {
  const result = await query(
    `SELECT bi.*, ip.name as provider_name, ip.code as provider_code, ip.category, ip.requires_config
     FROM business_integrations bi
     JOIN integration_providers ip ON bi.provider_id = ip.id
     WHERE bi.id = $1 AND bi.business_id = $2`,
    [id, businessId]
  );
  return result.rows[0] || null;
};

export const connectIntegration = async (businessId, providerCode, config, createdBy) => {
  const providerResult = await query(
    `SELECT id FROM integration_providers WHERE code = $1`,
    [providerCode]
  );
  if (providerResult.rows.length === 0) throw new Error('Provider not found.');
  const providerId = providerResult.rows[0].id;

  const result = await query(
    `INSERT INTO business_integrations (business_id, provider_id, status, config, connected_at, created_by)
     VALUES ($1, $2, 'connected', $3, NOW(), $4)
     ON CONFLICT (business_id, provider_id) DO UPDATE SET
       status = 'connected', config = EXCLUDED.config, connected_at = NOW(), updated_at = NOW()
     RETURNING *`,
    [businessId, providerId, JSON.stringify(config), createdBy]
  );
  return result.rows[0];
};

export const disconnectIntegration = async (integrationId, businessId) => {
  const result = await query(
    `UPDATE business_integrations SET status = 'disconnected', disconnected_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND business_id = $2 RETURNING *`,
    [integrationId, businessId]
  );
  return result.rows[0] || null;
};

export const updateIntegrationConfig = async (integrationId, businessId, config) => {
  const result = await query(
    `UPDATE business_integrations SET config = $1, updated_at = NOW()
     WHERE id = $2 AND business_id = $3 RETURNING *`,
    [JSON.stringify(config), integrationId, businessId]
  );
  return result.rows[0] || null;
};

export const testIntegration = async (integrationId, businessId) => {
  const integration = await getIntegrationById(integrationId, businessId);
  if (!integration) throw new Error('Integration not found.');

  // Placeholder - actual test depends on provider adapter
  const success = integration.provider_code === 'whatsapp_cloud'; // Mock test
  await query(
    `UPDATE business_integrations SET last_tested_at = NOW(), last_error = $1, updated_at = NOW()
     WHERE id = $2`,
    [success ? null : 'Test failed', integrationId]
  );
  return { success, provider: integration.provider_code };
};
