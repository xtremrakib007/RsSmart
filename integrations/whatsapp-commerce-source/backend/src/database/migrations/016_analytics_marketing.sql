-- Migration 016: Analytics & Marketing Foundation
-- Part 17 + 18 tables

CREATE TABLE IF NOT EXISTS analytics_daily_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,
  orders_count INTEGER DEFAULT 0,
  orders_total DECIMAL(12, 2) DEFAULT 0,
  customers_new INTEGER DEFAULT 0,
  customers_returning INTEGER DEFAULT 0,
  products_sold INTEGER DEFAULT 0,
  discounts_total DECIMAL(12, 2) DEFAULT 0,
  shipping_total DECIMAL(12, 2) DEFAULT 0,
  refunds_total DECIMAL(12, 2) DEFAULT 0,
  net_revenue DECIMAL(12, 2) DEFAULT 0,
  whatsapp_conversations INTEGER DEFAULT 0,
  whatsapp_orders INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, summary_date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_summary_business_date ON analytics_daily_summary(business_id, summary_date);

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('PROMOTIONAL', 'CUSTOMER_UPDATE', 'PRODUCT_ANNOUNCEMENT')),
  audience_segment VARCHAR(50),
  audience_tags TEXT[],
  audience_min_spending DECIMAL(12, 2),
  audience_min_orders INTEGER,
  audience_last_order_days INTEGER,
  template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'PAUSED', 'CANCELLED', 'FAILED')),
  scheduled_at TIMESTAMP WITH TIME ZONE,
  content TEXT,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  orders_generated INTEGER DEFAULT 0,
  revenue_generated DECIMAL(12, 2) DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_business_status ON campaigns(business_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON campaigns(scheduled_at) WHERE status = 'SCHEDULED';

CREATE TABLE IF NOT EXISTS campaign_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  phone VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'cancelled')),
  external_message_id VARCHAR(255),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(campaign_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_queue_pending ON campaign_queue(business_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_campaign_queue_campaign ON campaign_queue(campaign_id);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS promotional_opt_in BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS promotional_opt_in_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS promotional_opt_out BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS promotional_opt_out_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS marketing_source VARCHAR(100);

CREATE TABLE IF NOT EXISTS whatsapp_funnel_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES whatsapp_conversations(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('MESSAGE_RECEIVED', 'CONVERSATION_STARTED', 'PRODUCT_VIEW', 'CART_ADDED', 'CHECKOUT_STARTED', 'PAYMENT_INITIATED', 'ORDER_COMPLETED', 'HUMAN_HANDOFF')),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_funnel_events_business ON whatsapp_funnel_events(business_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_funnel_events_conversation ON whatsapp_funnel_events(conversation_id);

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
