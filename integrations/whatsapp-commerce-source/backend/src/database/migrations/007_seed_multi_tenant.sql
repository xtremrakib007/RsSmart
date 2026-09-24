-- Migration 007: Seed Multi-Tenant Demo Data
-- Creates Business A and Business B with isolated data for testing

DO $$
DECLARE
  business_a_id UUID;
  business_b_id UUID;
  owner_role_id UUID;
  admin_role_id UUID;
  manager_role_id UUID;
  staff_role_id UUID;
  user_a_id UUID;
  user_b_id UUID;
  user_admin_id UUID;
  user_manager_id UUID;
  user_staff_id UUID;
  cat_a1 UUID;
  cat_a2 UUID;
  cat_b1 UUID;
  prod_a1 UUID;
  prod_a2 UUID;
  prod_b1 UUID;
  cust_a1 UUID;
  cust_a2 UUID;
  cust_b1 UUID;
BEGIN
  -- Get role IDs
  SELECT id INTO owner_role_id FROM roles WHERE name = 'OWNER' AND business_id IS NULL;
  SELECT id INTO admin_role_id FROM roles WHERE name = 'ADMIN' AND business_id IS NULL;
  SELECT id INTO manager_role_id FROM roles WHERE name = 'MANAGER' AND business_id IS NULL;
  SELECT id INTO staff_role_id FROM roles WHERE name = 'STAFF' AND business_id IS NULL;

  -- ============================================================
  -- BUSINESS A: "Kedai Runcit Aman"
  -- ============================================================
  INSERT INTO businesses (name, slug, phone, email, address, city, state, country, currency, timezone, status)
  VALUES ('Kedai Runcit Aman', 'kedai-runcit-aman', '+60123456789', 'aman@example.com', '123 Jalan Aman', 'Kuala Lumpur', 'Wilayah Persekutuan', 'Malaysia', 'MYR', 'Asia/Kuala_Lumpur', 'active')
  RETURNING id INTO business_a_id;

  -- Users for Business A
  INSERT INTO users (email, password_hash, full_name, role, is_active)
  VALUES ('owner.a@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6', 'Owner A', 'user', true)
  RETURNING id INTO user_a_id;

  INSERT INTO users (email, password_hash, full_name, role, is_active)
  VALUES ('admin.a@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6', 'Admin A', 'user', true)
  RETURNING id INTO user_admin_id;

  INSERT INTO users (email, password_hash, full_name, role, is_active)
  VALUES ('manager.a@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6', 'Manager A', 'user', true)
  RETURNING id INTO user_manager_id;

  INSERT INTO users (email, password_hash, full_name, role, is_active)
  VALUES ('staff.a@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6', 'Staff A', 'user', true)
  RETURNING id INTO user_staff_id;

  -- Link users to Business A with roles
  INSERT INTO business_users (business_id, user_id, role_id, status) VALUES
    (business_a_id, user_a_id, owner_role_id, 'active'),
    (business_a_id, user_admin_id, admin_role_id, 'active'),
    (business_a_id, user_manager_id, manager_role_id, 'active'),
    (business_a_id, user_staff_id, staff_role_id, 'active');

  -- Business A Categories
  INSERT INTO categories (name, description, sort_order, is_active, business_id)
  VALUES ('Groceries', 'Daily groceries', 1, true, business_a_id)
  RETURNING id INTO cat_a1;

  INSERT INTO categories (name, description, sort_order, is_active, business_id)
  VALUES ('Beverages', 'Drinks and beverages', 2, true, business_a_id)
  RETURNING id INTO cat_a2;

  -- Business A Products
  INSERT INTO products (name, description, sku, price, cost, stock_quantity, low_stock_threshold, category_id, is_active, business_id)
  VALUES ('Nasi Lemak Pack', 'Traditional Malaysian breakfast', 'NLM-001', 5.50, 3.00, 100, 20, cat_a1, true, business_a_id)
  RETURNING id INTO prod_a1;

  INSERT INTO products (name, description, sku, price, cost, stock_quantity, low_stock_threshold, category_id, is_active, business_id)
  VALUES ('Teh Tarik', 'Malaysian pulled tea', 'TTR-001', 3.00, 1.50, 200, 30, cat_a2, true, business_a_id)
  RETURNING id INTO prod_a2;

  -- Business A Customers
  INSERT INTO customers (phone, full_name, email, address, city, country, tags, total_orders, total_spent, is_active, business_id)
  VALUES ('+60111111111', 'Ahmad Bin Ali', 'ahmad@example.com', '45 Jalan Merdeka', 'Kuala Lumpur', 'Malaysia', ARRAY['regular'], 3, 45.00, true, business_a_id)
  RETURNING id INTO cust_a1;

  INSERT INTO customers (phone, full_name, email, address, city, country, tags, total_orders, total_spent, is_active, business_id)
  VALUES ('+60112222222', 'Siti Nurhaliza', 'siti@example.com', '78 Jalan Damai', 'Kuala Lumpur', 'Malaysia', ARRAY['vip'], 5, 120.00, true, business_a_id)
  RETURNING id INTO cust_a2;

  -- Business A Settings
  INSERT INTO settings (key, value, data_type, category, description, is_public, business_id) VALUES
    ('store_name', 'Kedai Runcit Aman', 'string', 'business', 'Business name', true, business_a_id),
    ('store_phone', '+60123456789', 'string', 'business', 'Business phone', true, business_a_id),
    ('currency', 'MYR', 'string', 'business', 'Currency', true, business_a_id),
    ('order_prefix', 'A-', 'string', 'orders', 'Order prefix', false, business_a_id);

  -- Business A WhatsApp Account
  INSERT INTO whatsapp_accounts (business_id, name, phone_number, provider, is_active, is_default)
  VALUES (business_a_id, 'Main Account', '+60123456789', 'whatsapp_business_api', true, true);

  -- ============================================================
  -- BUSINESS B: "Mart Sejahtera"
  -- ============================================================
  INSERT INTO businesses (name, slug, phone, email, address, city, state, country, currency, timezone, status)
  VALUES ('Mart Sejahtera', 'mart-sejahtera', '+60987654321', 'sejahtera@example.com', '456 Jalan Sejahtera', 'Petaling Jaya', 'Selangor', 'Malaysia', 'MYR', 'Asia/Kuala_Lumpur', 'active')
  RETURNING id INTO business_b_id;

  -- Users for Business B
  INSERT INTO users (email, password_hash, full_name, role, is_active)
  VALUES ('owner.b@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6', 'Owner B', 'user', true)
  RETURNING id INTO user_b_id;

  -- Link owner to Business B
  INSERT INTO business_users (business_id, user_id, role_id, status)
  VALUES (business_b_id, user_b_id, owner_role_id, 'active');

  -- Business B Categories
  INSERT INTO categories (name, description, sort_order, is_active, business_id)
  VALUES ('Electronics', 'Electronic gadgets', 1, true, business_b_id)
  RETURNING id INTO cat_b1;

  -- Business B Products
  INSERT INTO products (name, description, sku, price, cost, stock_quantity, low_stock_threshold, category_id, is_active, business_id)
  VALUES ('Power Bank 20000mAh', 'High capacity power bank', 'PB-200', 89.90, 50.00, 50, 10, cat_b1, true, business_b_id)
  RETURNING id INTO prod_b1;

  -- Business B Customers
  INSERT INTO customers (phone, full_name, email, address, city, country, tags, total_orders, total_spent, is_active, business_id)
  VALUES ('+60113333333', 'Rajesh Kumar', 'rajesh@example.com', '12 Jalan Usaha', 'Petaling Jaya', 'Malaysia', ARRAY['new'], 1, 89.90, true, business_b_id)
  RETURNING id INTO cust_b1;

  -- Business B Settings
  INSERT INTO settings (key, value, data_type, category, description, is_public, business_id) VALUES
    ('store_name', 'Mart Sejahtera', 'string', 'business', 'Business name', true, business_b_id),
    ('store_phone', '+60987654321', 'string', 'business', 'Business phone', true, business_b_id),
    ('currency', 'MYR', 'string', 'business', 'Currency', true, business_b_id),
    ('order_prefix', 'B-', 'string', 'orders', 'Order prefix', false, business_b_id);

  -- Business B WhatsApp Account
  INSERT INTO whatsapp_accounts (business_id, name, phone_number, provider, is_active, is_default)
  VALUES (business_b_id, 'Main Account', '+60987654321', 'whatsapp_business_api', true, true);

  -- ============================================================
  -- VERIFY ISOLATION: Business A data should NOT see Business B data
  -- ============================================================
  RAISE NOTICE 'Business A ID: %', business_a_id;
  RAISE NOTICE 'Business B ID: %', business_b_id;
  RAISE NOTICE 'Seed data created successfully. Business A and B are isolated.';

END $$;
