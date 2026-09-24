-- Migration 024: Integration Marketplace
-- Part 26

CREATE TABLE IF NOT EXISTS integration_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('whatsapp', 'payment', 'courier', 'accounting', 'email', 'sms', 'analytics')),
  description TEXT,
  icon_url TEXT,
  documentation_url TEXT,
  is_active BOOLEAN DEFAULT true,
  requires_config JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES integration_providers(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'disconnected' CHECK (status IN ('available', 'connected', 'disconnected', 'error', 'needs_configuration')),
  config JSONB DEFAULT '{}',
  credentials_encrypted TEXT,
  last_tested_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  connected_at TIMESTAMP WITH TIME ZONE,
  disconnected_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_integrations_business ON business_integrations(business_id);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON business_integrations(status);

-- Seed initial providers
INSERT INTO integration_providers (name, code, category, description, is_active) VALUES
  ('WhatsApp Business Cloud API', 'whatsapp_cloud', 'whatsapp', 'Official WhatsApp Business Cloud API', true),
  ('Stripe', 'stripe', 'payment', 'Stripe payment processing', true),
  ('PayPal', 'paypal', 'payment', 'PayPal payment processing', true),
  ('Billplz', 'billplz', 'payment', 'Malaysian payment gateway', true),
  ('bKash', 'bkash', 'payment', 'Bangladesh mobile payment', true),
  ('J&T Express', 'jnt_express', 'courier', 'J&T Express courier service', true),
  ('Pos Laju', 'poslaju', 'courier', 'Pos Laju Malaysia', true),
  ('Pathao', 'pathao', 'courier', 'Pathao delivery Bangladesh', true),
  ('QuickBooks', 'quickbooks', 'accounting', 'QuickBooks accounting integration', true),
  ('Xero', 'xero', 'accounting', 'Xero accounting software', true),
  ('SendGrid', 'sendgrid', 'email', 'SendGrid email service', true),
  ('Twilio', 'twilio', 'sms', 'Twilio SMS service', true),
  ('Google Analytics', 'google_analytics', 'analytics', 'Google Analytics tracking', true)
ON CONFLICT (code) DO NOTHING;

DROP TRIGGER IF EXISTS update_business_integrations_updated_at ON business_integrations;
CREATE TRIGGER update_business_integrations_updated_at
  BEFORE UPDATE ON business_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
