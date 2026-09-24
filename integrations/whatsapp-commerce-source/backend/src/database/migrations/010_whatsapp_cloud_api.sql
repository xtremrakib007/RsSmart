-- Migration 010: REAL WhatsApp Business Cloud API
-- Multi-tenant WhatsApp accounts, message status tracking, idempotency

CREATE TABLE IF NOT EXISTS whatsapp_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  phone_number_id VARCHAR(100) NOT NULL,
  business_account_id VARCHAR(100),
  display_phone_number VARCHAR(50),
  access_token_encrypted TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'disconnected', 'error')),
  webhook_verify_token VARCHAR(255),
  webhook_configured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, phone_number_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_business ON whatsapp_accounts(business_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_phone ON whatsapp_accounts(phone_number_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='whatsapp_conversations' AND column_name='business_id') THEN
    ALTER TABLE whatsapp_conversations ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_business ON whatsapp_conversations(business_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='whatsapp_messages' AND column_name='business_id') THEN
    ALTER TABLE whatsapp_messages ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='whatsapp_messages' AND column_name='whatsapp_message_id') THEN
    ALTER TABLE whatsapp_messages ADD COLUMN whatsapp_message_id VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='whatsapp_messages' AND column_name='customer_id') THEN
    ALTER TABLE whatsapp_messages ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='whatsapp_messages' AND column_name='phone') THEN
    ALTER TABLE whatsapp_messages ADD COLUMN phone VARCHAR(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='whatsapp_messages' AND column_name='error_message') THEN
    ALTER TABLE whatsapp_messages ADD COLUMN error_message TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='whatsapp_messages' AND column_name='raw_payload') THEN
    ALTER TABLE whatsapp_messages ADD COLUMN raw_payload JSONB;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_inbound_unique
  ON whatsapp_messages(whatsapp_message_id, direction)
  WHERE direction = 'inbound';

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_whatsapp_id ON whatsapp_messages(whatsapp_message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_business ON whatsapp_messages(business_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_customer ON whatsapp_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation ON whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON whatsapp_messages(status);

CREATE TABLE IF NOT EXISTS webhook_processed_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id VARCHAR(255) NOT NULL UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_processed_events_id ON webhook_processed_events(event_id);

CREATE TABLE IF NOT EXISTS whatsapp_message_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES whatsapp_messages(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  raw_payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_status_history_message ON whatsapp_message_status_history(message_id);

DROP TRIGGER IF EXISTS update_whatsapp_accounts_updated_at ON whatsapp_accounts;
CREATE TRIGGER update_whatsapp_accounts_updated_at
  BEFORE UPDATE ON whatsapp_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
