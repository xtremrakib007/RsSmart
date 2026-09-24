-- Migration 008: Inventory & Pricing Engine
-- Adds pricing tables, customer B2B fields, inventory enhancements
-- Safe migration: does not delete existing data

-- ============================================================
-- 1. CUSTOMER B2B FIELDS
-- ============================================================

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS customer_type VARCHAR(20) DEFAULT 'b2c' CHECK (customer_type IN ('b2c', 'b2b', 'dealer'));

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(12, 2) DEFAULT 0;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(50) DEFAULT 'immediate';

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS price_level_id UUID;

-- ============================================================
-- 2. PRICE LEVELS (B2B / Wholesale / Dealer tiers)
-- ============================================================

CREATE TABLE IF NOT EXISTS price_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, code)
);

-- Create default price levels for each business
DO $$
DECLARE
  b RECORD;
BEGIN
  FOR b IN SELECT id FROM businesses LOOP
    INSERT INTO price_levels (business_id, name, code, description, is_default, is_active)
    VALUES
      (b.id, 'Retail', 'retail', 'Standard B2C retail price', true, true),
      (b.id, 'Wholesale', 'wholesale', 'B2B wholesale price', false, true),
      (b.id, 'Dealer', 'dealer', 'Dealer/distributor price', false, true)
    ON CONFLICT (business_id, code) DO NOTHING;
  END LOOP;
END $$;

-- ============================================================
-- 3. PRODUCT PRICES (per price level)
-- ============================================================

CREATE TABLE IF NOT EXISTS product_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_level_id UUID NOT NULL REFERENCES price_levels(id) ON DELETE CASCADE,
  price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, product_id, price_level_id)
);

-- Migrate existing product.price to product_prices retail level
DO $$
DECLARE
  b RECORD;
  p RECORD;
  retail_id UUID;
BEGIN
  FOR b IN SELECT id FROM businesses LOOP
    SELECT id INTO retail_id FROM price_levels WHERE business_id = b.id AND code = 'retail';
    IF retail_id IS NOT NULL THEN
      FOR p IN SELECT id, price FROM products WHERE business_id = b.id LOOP
        INSERT INTO product_prices (business_id, product_id, price_level_id, price, is_active)
        VALUES (b.id, p.id, retail_id, p.price, true)
        ON CONFLICT (business_id, product_id, price_level_id) DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 4. QUANTITY PRICE RULES (tier pricing per price level)
-- ============================================================

CREATE TABLE IF NOT EXISTS quantity_price_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_level_id UUID NOT NULL REFERENCES price_levels(id) ON DELETE CASCADE,
  min_quantity INTEGER NOT NULL DEFAULT 1,
  max_quantity INTEGER,
  unit_price DECIMAL(12, 2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT quantity_range_check CHECK (max_quantity IS NULL OR max_quantity >= min_quantity)
);

-- ============================================================
-- 5. CUSTOMER PRICE LEVELS (override per customer)
-- ============================================================

CREATE TABLE IF NOT EXISTS customer_price_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  price_level_id UUID NOT NULL REFERENCES price_levels(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, customer_id)
);

-- Migrate existing customer price_level_id to customer_price_levels
DO $$
DECLARE
  c RECORD;
  pl_id UUID;
BEGIN
  FOR c IN SELECT id, business_id, price_level_id FROM customers WHERE price_level_id IS NOT NULL LOOP
    INSERT INTO customer_price_levels (business_id, customer_id, price_level_id, is_active)
    VALUES (c.business_id, c.id, c.price_level_id, true)
    ON CONFLICT (business_id, customer_id) DO NOTHING;
  END LOOP;
END $$;

-- ============================================================
-- 6. INVENTORY MOVEMENTS ENHANCEMENTS
-- ============================================================

-- The table already exists from 006, ensure columns are correct
ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS movement_type VARCHAR(20) DEFAULT 'ADJUSTMENT'
    CHECK (movement_type IN ('PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT', 'DAMAGE', 'TRANSFER', 'RESTOCK'));

ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50);

ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS reference_id UUID;

ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================
-- 7. SETTINGS: allow_negative_stock
-- ============================================================

INSERT INTO settings (key, value, data_type, category, description, is_public, business_id)
SELECT 'allow_negative_stock', 'false', 'boolean', 'inventory', 'Allow selling products with negative stock', false, b.id
FROM businesses b
ON CONFLICT (business_id, key) DO NOTHING;

-- ============================================================
-- 8. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_price_levels_business ON price_levels(business_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_business ON product_prices(business_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_product ON product_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_level ON product_prices(price_level_id);
CREATE INDEX IF NOT EXISTS idx_quantity_rules_business ON quantity_price_rules(business_id);
CREATE INDEX IF NOT EXISTS idx_quantity_rules_product ON quantity_price_rules(product_id);
CREATE INDEX IF NOT EXISTS idx_customer_price_levels_business ON customer_price_levels(business_id);
CREATE INDEX IF NOT EXISTS idx_customer_price_levels_customer ON customer_price_levels(customer_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_business ON inventory_movements(business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(customer_type);

-- ============================================================
-- 9. TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS update_price_levels_updated_at ON price_levels;
CREATE TRIGGER update_price_levels_updated_at
  BEFORE UPDATE ON price_levels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_prices_updated_at ON product_prices;
CREATE TRIGGER update_product_prices_updated_at
  BEFORE UPDATE ON product_prices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quantity_price_rules_updated_at ON quantity_price_rules;
CREATE TRIGGER update_quantity_price_rules_updated_at
  BEFORE UPDATE ON quantity_price_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_price_levels_updated_at ON customer_price_levels;
CREATE TRIGGER update_customer_price_levels_updated_at
  BEFORE UPDATE ON customer_price_levels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
