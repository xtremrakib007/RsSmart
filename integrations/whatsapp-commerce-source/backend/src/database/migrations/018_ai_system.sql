-- Migration 018: AI Assistant System
-- Part 21 tables

CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  provider VARCHAR(50) DEFAULT 'openai',
  model VARCHAR(100) DEFAULT 'gpt-4o-mini',
  max_tokens INTEGER DEFAULT 500,
  temperature DECIMAL(3, 2) DEFAULT 0.7,
  monthly_usage_limit DECIMAL(12, 2) DEFAULT 50.00,
  system_prompt TEXT,
  handoff_keywords TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id)
);

CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES whatsapp_conversations(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  estimated_cost DECIMAL(12, 6) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_business ON ai_usage(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_monthly ON ai_usage(business_id, DATE_TRUNC('month', created_at));

DROP TRIGGER IF EXISTS update_ai_settings_updated_at ON ai_settings;
CREATE TRIGGER update_ai_settings_updated_at
  BEFORE UPDATE ON ai_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
