-- Migration 005: Settings & Business Configuration

-- Settings table (key-value with types for flexibility)
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  data_type VARCHAR(20) DEFAULT 'string' CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
  category VARCHAR(50) DEFAULT 'general',
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO settings (key, value, data_type, category, description, is_public) VALUES
  ('store_name', 'My WhatsApp Store', 'string', 'business', 'Business name displayed on receipts and emails', true),
  ('store_address', '', 'string', 'business', 'Business address', true),
  ('store_phone', '', 'string', 'business', 'Business phone number', true),
  ('store_email', '', 'string', 'business', 'Business email address', true),
  ('currency', 'MYR', 'string', 'business', 'Default currency code', true),
  ('currency_symbol', 'RM', 'string', 'business', 'Currency symbol for display', true),
  ('tax_rate', '0', 'number', 'tax', 'Tax rate percentage (0-100)', true),
  ('tax_enabled', 'false', 'boolean', 'tax', 'Whether tax is applied to orders', true),
  ('tax_inclusive', 'false', 'boolean', 'tax', 'Whether prices include tax', true),
  ('receipt_footer', 'Thank you for your business!', 'string', 'receipt', 'Footer text on receipts and invoices', true),
  ('business_hours', '{"mon":"9:00-18:00","tue":"9:00-18:00","wed":"9:00-18:00","thu":"9:00-18:00","fri":"9:00-18:00","sat":"9:00-13:00","sun":"closed"}', 'json', 'business', 'Business operating hours', true),
  ('order_prefix', 'ORD', 'string', 'orders', 'Prefix for order numbers', false),
  ('low_stock_alert', 'true', 'boolean', 'inventory', 'Enable low stock alerts', false),
  ('whatsapp_greeting', 'Hello! Welcome to our store. How can we help you today?', 'string', 'whatsapp', 'Auto-reply greeting message', false)
ON CONFLICT (key) DO NOTHING;

-- Trigger
DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
