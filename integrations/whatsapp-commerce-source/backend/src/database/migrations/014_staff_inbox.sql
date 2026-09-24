-- Migration 014: Staff WhatsApp Inbox + Human Takeover

-- Conversation assignments
CREATE TABLE IF NOT EXISTS conversation_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  unassigned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_assignments_business ON conversation_assignments(business_id);
CREATE INDEX IF NOT EXISTS idx_conv_assignments_conversation ON conversation_assignments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_assignments_assigned_to ON conversation_assignments(assigned_to);

-- Conversation internal notes
CREATE TABLE IF NOT EXISTS conversation_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_notes_conversation ON conversation_notes(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_notes_business ON conversation_notes(business_id);

-- Conversation tags
CREATE TABLE IF NOT EXISTS conversation_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(7) DEFAULT '#3b82f6',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, name)
);

-- Conversation tag assignments
CREATE TABLE IF NOT EXISTS conversation_tag_assignments (
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES conversation_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (conversation_id, tag_id)
);

-- Staff availability
CREATE TABLE IF NOT EXISTS staff_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'ONLINE' CHECK (status IN ('ONLINE', 'AWAY', 'OFFLINE')),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, user_id)
);

-- Conversation audit log
CREATE TABLE IF NOT EXISTS conversation_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_audit_conversation ON conversation_audit_log(conversation_id);

-- Add mode column to conversation states
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='whatsapp_conversation_states' AND column_name='mode') THEN
    ALTER TABLE whatsapp_conversation_states ADD COLUMN mode VARCHAR(20) DEFAULT 'BOT' CHECK (mode IN ('BOT', 'HUMAN'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='whatsapp_conversation_states' AND column_name='assigned_to') THEN
    ALTER TABLE whatsapp_conversation_states ADD COLUMN assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='whatsapp_conversation_states' AND column_name='status') THEN
    ALTER TABLE whatsapp_conversation_states ADD COLUMN status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PENDING', 'RESOLVED'));
  END IF;
END $$;

-- Seed system tags
INSERT INTO conversation_tags (business_id, name, color, is_system)
SELECT b.id, 'NEW_CUSTOMER', '#22c55e', true FROM businesses b
ON CONFLICT (business_id, name) DO NOTHING;

INSERT INTO conversation_tags (business_id, name, color, is_system)
SELECT b.id, 'ORDER_HELP', '#3b82f6', true FROM businesses b
ON CONFLICT (business_id, name) DO NOTHING;

INSERT INTO conversation_tags (business_id, name, color, is_system)
SELECT b.id, 'PAYMENT_HELP', '#f59e0b', true FROM businesses b
ON CONFLICT (business_id, name) DO NOTHING;

INSERT INTO conversation_tags (business_id, name, color, is_system)
SELECT b.id, 'DELIVERY_HELP', '#8b5cf6', true FROM businesses b
ON CONFLICT (business_id, name) DO NOTHING;

INSERT INTO conversation_tags (business_id, name, color, is_system)
SELECT b.id, 'COMPLAINT', '#ef4444', true FROM businesses b
ON CONFLICT (business_id, name) DO NOTHING;

INSERT INTO conversation_tags (business_id, name, color, is_system)
SELECT b.id, 'FOLLOW_UP', '#06b6d4', true FROM businesses b
ON CONFLICT (business_id, name) DO NOTHING;
