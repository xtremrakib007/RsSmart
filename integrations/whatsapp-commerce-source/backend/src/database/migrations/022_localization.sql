-- Migration 022: Localization, Tax & Invoice Settings
-- Part 24

-- Tax settings per business (stored in settings table, but structured here for clarity)
-- Using the existing settings table with these keys:
-- tax_enabled, tax_name, tax_rate, tax_inclusive, tax_number

-- Invoice settings
CREATE TABLE IF NOT EXISTS invoice_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  invoice_prefix VARCHAR(20) DEFAULT 'INV',
  invoice_start_number INTEGER DEFAULT 1,
  next_invoice_number INTEGER DEFAULT 1,
  receipt_prefix VARCHAR(20) DEFAULT 'RCP',
  next_receipt_number INTEGER DEFAULT 1,
  footer_text TEXT,
  business_registration_no VARCHAR(100),
  tax_registration_no VARCHAR(100),
  show_logo BOOLEAN DEFAULT true,
  show_tax_breakdown BOOLEAN DEFAULT true,
  terms_and_conditions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id)
);

-- Language preferences
CREATE TABLE IF NOT EXISTS business_languages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  language_code VARCHAR(10) NOT NULL DEFAULT 'en',
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, language_code)
);

-- Insert default invoice settings for existing businesses
INSERT INTO invoice_settings (business_id)
SELECT id FROM businesses
ON CONFLICT (business_id) DO NOTHING;

-- Insert default language for existing businesses
INSERT INTO business_languages (business_id, language_code, is_default, is_active)
SELECT id, 'en', true, true FROM businesses
ON CONFLICT (business_id, language_code) DO NOTHING;

DROP TRIGGER IF EXISTS update_invoice_settings_updated_at ON invoice_settings;
CREATE TRIGGER update_invoice_settings_updated_at
  BEFORE UPDATE ON invoice_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
