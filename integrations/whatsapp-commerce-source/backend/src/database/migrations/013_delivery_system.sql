-- Migration 013: Delivery and Fulfillment System

-- Deliveries / fulfillment records
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  fulfillment_type VARCHAR(30) NOT NULL CHECK (fulfillment_type IN ('CUSTOMER_PICKUP', 'LOCAL_DELIVERY', 'COURIER_DELIVERY')),
  recipient_name VARCHAR(255),
  recipient_phone VARCHAR(50),
  address_snapshot TEXT,
  address_city VARCHAR(100),
  address_state VARCHAR(100),
  address_postal_code VARCHAR(20),
  address_country VARCHAR(100) DEFAULT 'Malaysia',
  delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
  courier_provider VARCHAR(50),
  tracking_number VARCHAR(100),
  tracking_url TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'READY_FOR_PICKUP', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED', 'CANCELLED')),
  estimated_delivery_date DATE,
  driver_name VARCHAR(255),
  driver_phone VARCHAR(50),
  staff_notes TEXT,
  pickup_reference VARCHAR(50),
  picked_up_by VARCHAR(255),
  picked_up_at TIMESTAMP WITH TIME ZONE,
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  returned_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_business ON deliveries(business_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_order ON deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_customer ON deliveries(customer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_tracking ON deliveries(tracking_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deliveries_order_unique ON deliveries(order_id);

-- Delivery status history
CREATE TABLE IF NOT EXISTS delivery_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  old_status VARCHAR(30),
  new_status VARCHAR(30) NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  source VARCHAR(20) DEFAULT 'ADMIN' CHECK (source IN ('ADMIN', 'STAFF', 'COURIER', 'SYSTEM', 'CUSTOMER')),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_history_delivery ON delivery_status_history(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_history_business ON delivery_status_history(business_id);

-- Fulfillment settings per business
CREATE TABLE IF NOT EXISTS fulfillment_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  pickup_enabled BOOLEAN DEFAULT true,
  local_delivery_enabled BOOLEAN DEFAULT true,
  courier_delivery_enabled BOOLEAN DEFAULT true,
  free_delivery_threshold NUMERIC(12, 2),
  flat_delivery_fee NUMERIC(12, 2) DEFAULT 5,
  delivery_fee_type VARCHAR(20) DEFAULT 'FLAT_RATE' CHECK (delivery_fee_type IN ('FREE', 'FLAT_RATE', 'DISTANCE_BASED', 'AREA_BASED')),
  min_order_for_free_delivery NUMERIC(12, 2),
  local_delivery_area TEXT,
  business_hours JSONB DEFAULT '{"mon":"09:00-18:00","tue":"09:00-18:00","wed":"09:00-18:00","thu":"09:00-18:00","fri":"09:00-18:00","sat":"09:00-13:00","sun":"closed"}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Courier providers (abstract, manual for now)
CREATE TABLE IF NOT EXISTS courier_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, code)
);

-- Triggers
DROP TRIGGER IF EXISTS update_deliveries_updated_at ON deliveries;
CREATE TRIGGER update_deliveries_updated_at
  BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_fulfillment_settings_updated_at ON fulfillment_settings;
CREATE TRIGGER update_fulfillment_settings_updated_at
  BEFORE UPDATE ON fulfillment_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
