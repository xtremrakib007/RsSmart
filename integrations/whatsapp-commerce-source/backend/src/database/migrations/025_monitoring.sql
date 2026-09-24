-- Migration 025: Monitoring & System Health
-- Part 28

CREATE TABLE IF NOT EXISTS system_errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id VARCHAR(100),
  service VARCHAR(50) NOT NULL,
  route VARCHAR(255),
  error_type VARCHAR(100) NOT NULL,
  error_message TEXT,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  stack_trace TEXT,
  metadata JSONB DEFAULT '{}',
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('database_down', 'whatsapp_api_fail', 'payment_fail', 'webhook_fail', 'queue_stopped', 'high_error_rate', 'disk_space')),
  threshold INTEGER,
  window_minutes INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  notify_email VARCHAR(255),
  notify_webhook TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_errors_created ON system_errors(created_at);
CREATE INDEX IF NOT EXISTS idx_system_errors_service ON system_errors(service, created_at);
CREATE INDEX IF NOT EXISTS idx_system_errors_business ON system_errors(business_id);
CREATE INDEX IF NOT EXISTS idx_system_errors_resolved ON system_errors(resolved, created_at);
CREATE INDEX IF NOT EXISTS idx_alert_history_created ON alert_history(created_at);

-- Seed default alert rules
INSERT INTO alert_rules (name, alert_type, threshold, window_minutes, is_active) VALUES
  ('Database Unavailable', 'database_down', 1, 1, true),
  ('WhatsApp API Failure', 'whatsapp_api_fail', 5, 5, true),
  ('Payment Failure Rate', 'payment_fail', 10, 10, true),
  ('High Error Rate', 'high_error_rate', 50, 5, true)
ON CONFLICT DO NOTHING;
