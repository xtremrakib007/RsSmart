import { query } from '../database/connection.js';
import { getSettingValue, updateMultipleSettings } from './settings.service.js';

export const SUPPORTED_COUNTRIES = [
  { code: 'MY', name: 'Malaysia', currency: 'MYR', timezone: 'Asia/Kuala_Lumpur', phoneCode: '+60' },
  { code: 'BD', name: 'Bangladesh', currency: 'BDT', timezone: 'Asia/Dhaka', phoneCode: '+880' },
];

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'bn', name: 'Bangla', nativeName: 'বাংলা' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu' },
];

export const getBusinessLocalization = async (businessId) => {
  const [country, currency, timezone, taxEnabled, taxName, taxRate, taxInclusive] = await Promise.all([
    getSettingValue('country', businessId, 'MY'),
    getSettingValue('currency', businessId, 'MYR'),
    getSettingValue('timezone', businessId, 'Asia/Kuala_Lumpur'),
    getSettingValue('tax_enabled', businessId, false),
    getSettingValue('tax_name', businessId, 'Tax'),
    getSettingValue('tax_rate', businessId, 0),
    getSettingValue('tax_inclusive', businessId, false),
  ]);

  const langResult = await query(
    `SELECT language_code, is_default, is_active FROM business_languages WHERE business_id = $1`,
    [businessId]
  );

  return {
    country,
    currency,
    timezone,
    tax: { enabled: taxEnabled, name: taxName, rate: parseFloat(taxRate) || 0, inclusive: taxInclusive },
    languages: langResult.rows,
  };
};

export const updateTaxSettings = async (businessId, taxSettings) => {
  await updateMultipleSettings({
    tax_enabled: taxSettings.enabled,
    tax_name: taxSettings.name,
    tax_rate: taxSettings.rate,
    tax_inclusive: taxSettings.inclusive,
  }, businessId);
  return getBusinessLocalization(businessId);
};

export const getInvoiceSettings = async (businessId) => {
  const result = await query(
    `SELECT * FROM invoice_settings WHERE business_id = $1`,
    [businessId]
  );
  if (result.rows.length === 0) {
    await query(`INSERT INTO invoice_settings (business_id) VALUES ($1)`, [businessId]);
    const newResult = await query(`SELECT * FROM invoice_settings WHERE business_id = $1`, [businessId]);
    return newResult.rows[0];
  }
  return result.rows[0];
};

export const updateInvoiceSettings = async (businessId, data) => {
  const fields = [];
  const params = [];
  let idx = 1;
  const allowed = ['invoice_prefix', 'invoice_start_number', 'next_invoice_number', 'receipt_prefix',
    'next_receipt_number', 'footer_text', 'business_registration_no', 'tax_registration_no',
    'show_logo', 'show_tax_breakdown', 'terms_and_conditions'];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      params.push(data[key]);
      idx++;
    }
  }
  if (fields.length === 0) return null;
  params.push(businessId);
  const result = await query(
    `UPDATE invoice_settings SET ${fields.join(', ')}, updated_at = NOW() WHERE business_id = $${idx} RETURNING *`,
    params
  );
  return result.rows[0];
};

export const updateBusinessLanguages = async (businessId, languages) => {
  await query(`DELETE FROM business_languages WHERE business_id = $1`, [businessId]);
  for (const lang of languages) {
    await query(
      `INSERT INTO business_languages (business_id, language_code, is_default, is_active)
       VALUES ($1, $2, $3, $4)`,
      [businessId, lang.code, lang.isDefault || false, lang.isActive !== false]
    );
  }
  const result = await query(
    `SELECT language_code, is_default, is_active FROM business_languages WHERE business_id = $1`,
    [businessId]
  );
  return result.rows;
};
