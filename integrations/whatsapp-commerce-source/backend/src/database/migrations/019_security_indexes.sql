-- Migration 019: Performance & Security Indexes
-- Part 17.5 + 20 optimizations

CREATE INDEX IF NOT EXISTS idx_orders_business_created ON orders(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_business_status ON orders(business_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_business_source ON orders(business_id, source, created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_customers_business_type ON customers(business_id, customer_type);
CREATE INDEX IF NOT EXISTS idx_customers_business_created ON customers(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payments_business_status ON payments(business_id, status);
CREATE INDEX IF NOT EXISTS idx_deliveries_business_status ON deliveries(business_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_business ON inventory_movements(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_business ON whatsapp_messages(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_business ON audit_logs(business_id, created_at);

CREATE INDEX IF NOT EXISTS idx_orders_pending ON orders(business_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_payments_pending ON payments(business_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_deliveries_pending ON deliveries(business_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS rate_limit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(255) NOT NULL,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  request_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_key_window ON rate_limit_logs(key, window_start);
