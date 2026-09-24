-- Migration 006: Multi-Tenant Architecture
-- Creates businesses, roles, permissions, business_users
-- Adds business_id to all business-owned tables
-- Migrates existing data safely

-- ============================================================
-- 1. CORE TENANT TABLES
-- ============================================================

-- Businesses table
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Malaysia',
  currency VARCHAR(10) DEFAULT 'MYR',
  timezone VARCHAR(50) DEFAULT 'Asia/Kuala_Lumpur',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Roles table (business_id NULL = system/global role)
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, name)
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Role-Permissions junction
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

-- Business-Users junction (a user can belong to multiple businesses)
CREATE TABLE IF NOT EXISTS business_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, user_id)
);

-- ============================================================
-- 2. ADD business_id TO ALL BUSINESS-OWNED TABLES
-- ============================================================

-- Categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;

-- Products
ALTER TABLE products ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;

-- Customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;

-- Orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;

-- Order items (inherits via order, but add for direct queries if needed)
-- Note: order_items business context comes through orders join

-- Message templates
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;

-- WhatsApp conversations
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;

-- WhatsApp messages (inherits via conversation)
-- Note: whatsapp_messages business context comes through conversations join

-- Webhook logs
ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;

-- Settings - transform from global to per-business
-- First add business_id, then migrate data
ALTER TABLE settings ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
-- Drop the unique constraint on key since it's now per-business
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_key_key;
-- Add composite unique constraint
ALTER TABLE settings ADD CONSTRAINT settings_business_key_unique UNIQUE (business_id, key);

-- Audit logs table (new)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  resource VARCHAR(50) NOT NULL,
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table (new)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory movements table (new, for audit trail)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity_change INTEGER NOT NULL,
  reason VARCHAR(100),
  reference_type VARCHAR(50),
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deliveries table (new)
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending',
  tracking_number VARCHAR(255),
  carrier VARCHAR(100),
  estimated_delivery TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  delivery_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments table (new)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'MYR',
  method VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  transaction_id VARCHAR(255),
  gateway_response JSONB,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp accounts table (new)
CREATE TABLE IF NOT EXISTS whatsapp_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(50) NOT NULL,
  provider VARCHAR(50) DEFAULT 'whatsapp_business_api',
  api_key TEXT,
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, phone_number)
);

-- ============================================================
-- 3. MIGRATE EXISTING DATA
-- ============================================================

-- Create default business for existing data
DO $$
DECLARE
  default_business_id UUID;
BEGIN
  -- Only create default business if no businesses exist
  IF NOT EXISTS (SELECT 1 FROM businesses LIMIT 1) THEN
    INSERT INTO businesses (name, slug, status)
    VALUES ('Default Business', 'default-business', 'active')
    RETURNING id INTO default_business_id;

    -- Assign all existing data to default business
    UPDATE categories SET business_id = default_business_id WHERE business_id IS NULL;
    UPDATE products SET business_id = default_business_id WHERE business_id IS NULL;
    UPDATE customers SET business_id = default_business_id WHERE business_id IS NULL;
    UPDATE orders SET business_id = default_business_id WHERE business_id IS NULL;
    UPDATE message_templates SET business_id = default_business_id WHERE business_id IS NULL;
    UPDATE whatsapp_conversations SET business_id = default_business_id WHERE business_id IS NULL;
    UPDATE webhook_logs SET business_id = default_business_id WHERE business_id IS NULL;
    UPDATE settings SET business_id = default_business_id WHERE business_id IS NULL;

    -- Create system roles
    INSERT INTO roles (business_id, name, description, is_system) VALUES
      (NULL, 'OWNER', 'Full access to business', true),
      (NULL, 'ADMIN', 'Business management except ownership', true),
      (NULL, 'MANAGER', 'Products, inventory, customers, orders, reports', true),
      (NULL, 'STAFF', 'Customers, orders and assigned conversations', true)
    ON CONFLICT DO NOTHING;

    -- Create permissions
    INSERT INTO permissions (name, resource, action, description) VALUES
      ('business:read', 'business', 'read', 'View business details'),
      ('business:update', 'business', 'update', 'Update business details'),
      ('business:delete', 'business', 'delete', 'Delete business'),
      ('user:manage', 'user', 'manage', 'Manage business users'),
      ('product:read', 'product', 'read', 'View products'),
      ('product:create', 'product', 'create', 'Create products'),
      ('product:update', 'product', 'update', 'Update products'),
      ('product:delete', 'product', 'delete', 'Delete products'),
      ('category:read', 'category', 'read', 'View categories'),
      ('category:create', 'category', 'create', 'Create categories'),
      ('category:update', 'category', 'update', 'Update categories'),
      ('category:delete', 'category', 'delete', 'Delete categories'),
      ('customer:read', 'customer', 'read', 'View customers'),
      ('customer:create', 'customer', 'create', 'Create customers'),
      ('customer:update', 'customer', 'update', 'Update customers'),
      ('customer:delete', 'customer', 'delete', 'Delete customers'),
      ('order:read', 'order', 'read', 'View orders'),
      ('order:create', 'order', 'create', 'Create orders'),
      ('order:update', 'order', 'update', 'Update orders'),
      ('order:delete', 'order', 'delete', 'Delete orders'),
      ('inventory:read', 'inventory', 'read', 'View inventory'),
      ('inventory:update', 'inventory', 'update', 'Update inventory'),
      ('settings:read', 'settings', 'read', 'View settings'),
      ('settings:update', 'settings', 'update', 'Update settings'),
      ('whatsapp:read', 'whatsapp', 'read', 'View WhatsApp conversations'),
      ('whatsapp:send', 'whatsapp', 'send', 'Send WhatsApp messages'),
      ('template:read', 'template', 'read', 'View message templates'),
      ('template:create', 'template', 'create', 'Create message templates'),
      ('template:update', 'template', 'update', 'Update message templates'),
      ('template:delete', 'template', 'delete', 'Delete message templates'),
      ('analytics:read', 'analytics', 'read', 'View analytics and reports'),
      ('audit:read', 'audit', 'read', 'View audit logs')
    ON CONFLICT (name) DO NOTHING;

    -- Assign permissions to roles
    -- OWNER: all permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r, permissions p
    WHERE r.name = 'OWNER' AND r.business_id IS NULL
    ON CONFLICT DO NOTHING;

    -- ADMIN: all except business:delete, user:manage (full), audit:read
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r, permissions p
    WHERE r.name = 'ADMIN' AND r.business_id IS NULL
      AND p.name NOT IN ('business:delete', 'audit:read')
    ON CONFLICT DO NOTHING;

    -- MANAGER: product, category, customer, order, inventory, analytics, whatsapp read/send, template
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r, permissions p
    WHERE r.name = 'MANAGER' AND r.business_id IS NULL
      AND p.name IN (
        'product:read', 'product:create', 'product:update', 'product:delete',
        'category:read', 'category:create', 'category:update', 'category:delete',
        'customer:read', 'customer:create', 'customer:update', 'customer:delete',
        'order:read', 'order:create', 'order:update', 'order:delete',
        'inventory:read', 'inventory:update',
        'settings:read',
        'whatsapp:read', 'whatsapp:send',
        'template:read', 'template:create', 'template:update', 'template:delete',
        'analytics:read'
      )
    ON CONFLICT DO NOTHING;

    -- STAFF: customer read/create/update, order read/create/update, whatsapp read/send
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r, permissions p
    WHERE r.name = 'STAFF' AND r.business_id IS NULL
      AND p.name IN (
        'customer:read', 'customer:create', 'customer:update',
        'order:read', 'order:create', 'order:update',
        'whatsapp:read', 'whatsapp:send',
        'product:read'
      )
    ON CONFLICT DO NOTHING;

    -- Link existing users to default business as OWNER
    INSERT INTO business_users (business_id, user_id, role_id, status)
    SELECT default_business_id, u.id, r.id, 'active'
    FROM users u
    CROSS JOIN roles r
    WHERE r.name = 'OWNER' AND r.business_id IS NULL
    ON CONFLICT DO NOTHING;

  END IF;
END $$;

-- ============================================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_categories_business ON categories(business_id);
CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_business_active ON products(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_business ON orders(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_business_status ON orders(business_id, status);
CREATE INDEX IF NOT EXISTS idx_settings_business ON settings(business_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_business ON message_templates(business_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_business ON whatsapp_conversations(business_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_business ON webhook_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_business ON audit_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_business_users_user ON business_users(user_id);
CREATE INDEX IF NOT EXISTS idx_business_users_business ON business_users(business_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_business ON inventory_movements(business_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_business ON deliveries(business_id);
CREATE INDEX IF NOT EXISTS idx_payments_business ON payments(business_id);
CREATE INDEX IF NOT EXISTS idx_notifications_business ON notifications(business_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_business ON whatsapp_accounts(business_id);

-- ============================================================
-- 5. TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS update_businesses_updated_at ON businesses;
CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_business_users_updated_at ON business_users;
CREATE TRIGGER update_business_users_updated_at
  BEFORE UPDATE ON business_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deliveries_updated_at ON deliveries;
CREATE TRIGGER update_deliveries_updated_at
  BEFORE UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_whatsapp_accounts_updated_at ON whatsapp_accounts;
CREATE TRIGGER update_whatsapp_accounts_updated_at
  BEFORE UPDATE ON whatsapp_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
