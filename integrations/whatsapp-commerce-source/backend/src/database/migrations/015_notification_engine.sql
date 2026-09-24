-- Migration 015: Notification Engine + Templates + Automation

-- Enhanced message templates (merge with existing if present)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='message_templates' AND column_name='business_id') THEN
    ALTER TABLE message_templates ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='message_templates' AND column_name='provider_template_name') THEN
    ALTER TABLE message_templates ADD COLUMN provider_template_name VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='message_templates' AND column_name='template_status') THEN
    ALTER TABLE message_templates ADD COLUMN template_status VARCHAR(20) DEFAULT 'DRAFT' CHECK (template_status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'DISABLED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='message_templates' AND column_name='template_category') THEN
    ALTER TABLE message_templates ADD COLUMN template_category VARCHAR(20) DEFAULT 'UTILITY' CHECK (template_category IN ('UTILITY', 'AUTHENTICATION', 'MARKETING'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='message_templates' AND column_name='language_code') THEN
    ALTER TABLE message_templates ADD COLUMN language_code VARCHAR(10) DEFAULT 'en';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_message_templates_business ON message_templates(business_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_status ON message_templates(template_status);

-- Automation rules
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  event VARCHAR(50) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  conditions JSONB DEFAULT '{}',
  action VARCHAR(50) NOT NULL,
  template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  delay_minutes INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_business ON automation_rules(business_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_event ON automation_rules(event);

-- Notification logs
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  event VARCHAR(50) NOT NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
  status VARCHAR(20) NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED')),
  provider_message_id VARCHAR(255),
  rendered_body TEXT,
  error TEXT,
  idempotency_key VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_business ON notification_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_customer ON notification_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_order ON notification_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_event ON notification_logs(event);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_idempotency ON notification_logs(idempotency_key);

-- Customer notification preferences
CREATE TABLE IF NOT EXISTS customer_notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_updates BOOLEAN DEFAULT true,
  payment_updates BOOLEAN DEFAULT true,
  delivery_updates BOOLEAN DEFAULT true,
  promotional_messages BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(customer_id, business_id)
);

-- Job queue (simple table-based, can be upgraded to Redis later)
CREATE TABLE IF NOT EXISTS job_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  job_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status);
CREATE INDEX IF NOT EXISTS idx_job_queue_scheduled ON job_queue(scheduled_at);

-- Triggers
DROP TRIGGER IF EXISTS update_automation_rules_updated_at ON automation_rules;
CREATE TRIGGER update_automation_rules_updated_at
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed default automation rules for each business
INSERT INTO automation_rules (business_id, name, event, action, template_id, enabled)
SELECT 
  b.id,
  'Order Confirmed Notification',
  'ORDER_CONFIRMED',
  'send_whatsapp',
  NULL,
  true
FROM businesses b
ON CONFLICT DO NOTHING;

INSERT INTO automation_rules (business_id, name, event, action, template_id, enabled)
SELECT 
  b.id,
  'Payment Received Notification',
  'PAYMENT_PAID',
  'send_whatsapp',
  NULL,
  true
FROM businesses b
ON CONFLICT DO NOTHING;

INSERT INTO automation_rules (business_id, name, event, action, template_id, enabled)
SELECT 
  b.id,
  'Order Shipped Notification',
  'ORDER_SHIPPED',
  'send_whatsapp',
  NULL,
  true
FROM businesses b
ON CONFLICT DO NOTHING;
