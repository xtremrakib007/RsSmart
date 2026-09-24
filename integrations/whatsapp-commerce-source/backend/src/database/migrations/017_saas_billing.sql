-- Migration 017: SaaS Subscription & Billing
-- Part 19 tables

CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  price_monthly DECIMAL(12, 2) NOT NULL DEFAULT 0,
  price_yearly DECIMAL(12, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'MYR',
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plan_features (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  feature_key VARCHAR(100) NOT NULL,
  feature_value INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(plan_id, feature_key)
);

INSERT INTO plans (name, code, description, price_monthly, price_yearly, is_active, is_public, sort_order) VALUES
  ('Free', 'FREE', 'Basic WhatsApp commerce for small sellers', 0, 0, true, true, 1),
  ('Starter', 'STARTER', 'Growing businesses with basic automation', 49, 490, true, true, 2),
  ('Pro', 'PRO', 'Advanced features and higher limits', 149, 1490, true, true, 3),
  ('Business', 'BUSINESS', 'Multiple staff and full analytics', 399, 3990, true, true, 4),
  ('Enterprise', 'ENTERPRISE', 'Custom solutions and dedicated support', 0, 0, true, false, 5)
ON CONFLICT (code) DO NOTHING;

DO $$
DECLARE
  free_id UUID;
  starter_id UUID;
  pro_id UUID;
  business_id UUID;
  enterprise_id UUID;
BEGIN
  SELECT id INTO free_id FROM plans WHERE code = 'FREE';
  SELECT id INTO starter_id FROM plans WHERE code = 'STARTER';
  SELECT id INTO pro_id FROM plans WHERE code = 'PRO';
  SELECT id INTO business_id FROM plans WHERE code = 'BUSINESS';
  SELECT id INTO enterprise_id FROM plans WHERE code = 'ENTERPRISE';

  INSERT INTO plan_features (plan_id, feature_key, feature_value) VALUES
    (free_id, 'products', 50),
    (free_id, 'customers', 200),
    (free_id, 'staff_users', 1),
    (free_id, 'conversations_monthly', 500),
    (free_id, 'campaigns', 0),
    (free_id, 'automation_rules', 2),
    (free_id, 'storage_mb', 100),
    (free_id, 'analytics_retention_days', 7),
    (free_id, 'ai_messages', 0)
  ON CONFLICT DO NOTHING;

  INSERT INTO plan_features (plan_id, feature_key, feature_value) VALUES
    (starter_id, 'products', 500),
    (starter_id, 'customers', 2000),
    (starter_id, 'staff_users', 3),
    (starter_id, 'conversations_monthly', 5000),
    (starter_id, 'campaigns', 5),
    (starter_id, 'automation_rules', 10),
    (starter_id, 'storage_mb', 1000),
    (starter_id, 'analytics_retention_days', 30),
    (starter_id, 'ai_messages', 100)
  ON CONFLICT DO NOTHING;

  INSERT INTO plan_features (plan_id, feature_key, feature_value) VALUES
    (pro_id, 'products', 5000),
    (pro_id, 'customers', 20000),
    (pro_id, 'staff_users', 10),
    (pro_id, 'conversations_monthly', 50000),
    (pro_id, 'campaigns', 50),
    (pro_id, 'automation_rules', 50),
    (pro_id, 'storage_mb', 10000),
    (pro_id, 'analytics_retention_days', 90),
    (pro_id, 'ai_messages', 1000)
  ON CONFLICT DO NOTHING;

  INSERT INTO plan_features (plan_id, feature_key, feature_value) VALUES
    (business_id, 'products', 0),
    (business_id, 'customers', 0),
    (business_id, 'staff_users', 50),
    (business_id, 'conversations_monthly', 200000),
    (business_id, 'campaigns', 200),
    (business_id, 'automation_rules', 200),
    (business_id, 'storage_mb', 50000),
    (business_id, 'analytics_retention_days', 365),
    (business_id, 'ai_messages', 10000)
  ON CONFLICT DO NOTHING;

  INSERT INTO plan_features (plan_id, feature_key, feature_value) VALUES
    (enterprise_id, 'products', 0),
    (enterprise_id, 'customers', 0),
    (enterprise_id, 'staff_users', 0),
    (enterprise_id, 'conversations_monthly', 0),
    (enterprise_id, 'campaigns', 0),
    (enterprise_id, 'automation_rules', 0),
    (enterprise_id, 'storage_mb', 0),
    (enterprise_id, 'analytics_retention_days', 0),
    (enterprise_id, 'ai_messages', 0)
  ON CONFLICT DO NOTHING;
END $$;

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  provider VARCHAR(50) NOT NULL DEFAULT 'mock',
  provider_customer_id VARCHAR(255),
  provider_subscription_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'TRIALING' CHECK (status IN ('TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELLED', 'EXPIRED')),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_business ON subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  provider_event_id VARCHAR(255),
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_unprocessed ON subscription_events(processed, created_at);

DROP TRIGGER IF EXISTS update_plans_updated_at ON plans;
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
