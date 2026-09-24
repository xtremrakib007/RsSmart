-- Migration 011: WhatsApp Shopping Flow
-- Conversation states, customer addresses, commerce flow support

CREATE TABLE IF NOT EXISTS whatsapp_conversation_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  state VARCHAR(50) NOT NULL DEFAULT 'MAIN_MENU',
  state_data JSONB DEFAULT '{}',
  staff_handling BOOLEAN DEFAULT false,
  staff_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, customer_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_states_business ON whatsapp_conversation_states(business_id);
CREATE INDEX IF NOT EXISTS idx_conversation_states_customer ON whatsapp_conversation_states(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversation_states_conversation ON whatsapp_conversation_states(conversation_id);

DROP TRIGGER IF EXISTS update_conversation_states_updated_at ON whatsapp_conversation_states;
CREATE TRIGGER update_conversation_states_updated_at
  BEFORE UPDATE ON whatsapp_conversation_states
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Customer addresses (if not exists)
CREATE TABLE IF NOT EXISTS customer_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  label VARCHAR(50) DEFAULT 'home',
  full_name VARCHAR(255),
  phone VARCHAR(50),
  address TEXT NOT NULL,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'Malaysia',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_business ON customer_addresses(business_id);

DROP TRIGGER IF EXISTS update_customer_addresses_updated_at ON customer_addresses;
CREATE TRIGGER update_customer_addresses_updated_at
  BEFORE UPDATE ON customer_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
