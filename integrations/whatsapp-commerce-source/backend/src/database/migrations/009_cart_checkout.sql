-- Migration 009: Cart + Checkout + Order Transaction System
-- Adds cart tables, order snapshot fields, payment records, delivery addresses

-- ============================================================
-- 1. CART TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, customer_id)
);

CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(cart_id, product_id)
);

-- ============================================================
-- 2. ORDER SNAPSHOT FIELDS (ensure historical accuracy)
-- ============================================================

-- order_items already has product_name snapshot
-- Add SKU snapshot to order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_sku VARCHAR(100);

-- Add price level tracking to order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS price_level_id UUID REFERENCES price_levels(id) ON DELETE SET NULL;

-- Add customer type snapshot to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_type VARCHAR(20) DEFAULT 'b2c';

-- Add order number (human-readable)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number VARCHAR(50);

-- Create unique order numbers per business
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_number_business ON orders(order_number, business_id);

-- ============================================================
-- 3. PAYMENT RECORDS
-- ============================================================

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'MYR',
  method VARCHAR(50),
  status VARCHAR(50) DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PENDING', 'PAID', 'FAILED', 'PARTIALLY_PAID', 'REFUNDED')),
  transaction_id VARCHAR(255),
  gateway_response JSONB,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 4. DELIVERY ADDRESSES (for customers)
-- ============================================================

CREATE TABLE IF NOT EXISTS delivery_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label VARCHAR(100) DEFAULT 'Default',
  address TEXT NOT NULL,
  city VARCHAR(100),
  state VARCHAR(100),
  postcode VARCHAR(20),
  country VARCHAR(100) DEFAULT 'Malaysia',
  phone VARCHAR(50),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 5. ORDER STATUS EXTENSION
-- ============================================================

-- Add 'ready' and 'refunded' to order status if not already supported
-- The existing status is VARCHAR(50), so we just need to ensure the app supports these values

-- ============================================================
-- 6. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_carts_business ON carts(business_id);
CREATE INDEX IF NOT EXISTS idx_carts_customer ON carts(customer_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product ON cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_payments_business ON payments(business_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_delivery_addresses_customer ON delivery_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_addresses_business ON delivery_addresses(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_type ON orders(customer_type);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- ============================================================
-- 7. TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS update_carts_updated_at ON carts;
CREATE TRIGGER update_carts_updated_at
  BEFORE UPDATE ON carts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cart_items_updated_at ON cart_items;
CREATE TRIGGER update_cart_items_updated_at
  BEFORE UPDATE ON cart_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_delivery_addresses_updated_at ON delivery_addresses;
CREATE TRIGGER update_delivery_addresses_updated_at
  BEFORE UPDATE ON delivery_addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
