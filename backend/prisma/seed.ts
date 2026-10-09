import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // This seed creates publicly predictable demo identities and must never run in production.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run demo seed in production');
  }
  const seedPassword = process.env.DEMO_SEED_PASSWORD;
  if (!seedPassword || seedPassword.length < 16) {
    throw new Error('Set DEMO_SEED_PASSWORD to a value of at least 16 characters before running the demo seed');
  }
  console.log('🌱 Starting database seed...');

  // ─── TENANT ─────────────────────────────────────────────
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Demo Company',
      slug: 'demo-company',
      status: 'ACTIVE',
      settings: {
        currency: 'USD',
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        defaultTaxRate: 10,
        approvalRequired: true,
        orderPrefix: 'ORD',
      },
    },
  });
  console.log(`✅ Tenant created: ${tenant.name}`);

  // ─── ROLES ──────────────────────────────────────────────
  const roles = await prisma.role.createMany({
    data: [
      { tenantId: tenant.id, name: 'admin', description: 'Full system access', permissions: ['*'], isSystem: true },
      { tenantId: tenant.id, name: 'manager', description: 'Manage operations', permissions: ['users.read', 'users.write', 'products.*', 'orders.*', 'customers.*', 'payments.collect', 'inventory.read', 'inventory.adjust', 'outlets.read', 'reports.*'], isSystem: true },
      { tenantId: tenant.id, name: 'sales_rep', description: 'Field sales', permissions: ['customers.*', 'orders.create', 'orders.read', 'visits.*'], isSystem: true },
      { tenantId: tenant.id, name: 'cashier', description: 'POS operations', permissions: ['pos.*', 'products.read', 'customers.read', 'inventory.read'], isSystem: true },
      { tenantId: tenant.id, name: 'accountant', description: 'Financial operations', permissions: ['orders.read', 'payments.*', 'reports.*'], isSystem: true },
    ],
  });
  console.log(`✅ Roles created: ${roles.count}`);

  const adminRole = await prisma.role.findFirst({ where: { tenantId: tenant.id, name: 'admin' } });
  const managerRole = await prisma.role.findFirst({ where: { tenantId: tenant.id, name: 'manager' } });
  const salesRole = await prisma.role.findFirst({ where: { tenantId: tenant.id, name: 'sales_rep' } });
  const cashierRole = await prisma.role.findFirst({ where: { tenantId: tenant.id, name: 'cashier' } });

  // ─── USERS ──────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash(seedPassword, 12);

  const users = await prisma.user.createMany({
    data: [
      { tenantId: tenant.id, email: 'admin@demo.com', password: hashedPassword, firstName: 'System', lastName: 'Admin', status: 'ACTIVE' },
      { tenantId: tenant.id, email: 'manager@demo.com', password: hashedPassword, firstName: 'Store', lastName: 'Manager', status: 'ACTIVE' },
      { tenantId: tenant.id, email: 'sales1@demo.com', password: hashedPassword, firstName: 'John', lastName: 'Salesman', status: 'ACTIVE' },
      { tenantId: tenant.id, email: 'sales2@demo.com', password: hashedPassword, firstName: 'Jane', lastName: 'Saleswoman', status: 'ACTIVE' },
      { tenantId: tenant.id, email: 'cashier@demo.com', password: hashedPassword, firstName: 'Cash', lastName: 'Drawer', status: 'ACTIVE' },
    ],
  });
  console.log(`✅ Users created: ${users.count}`);

  // Assign roles
  const allUsers = await prisma.user.findMany({ where: { tenantId: tenant.id } });
  await prisma.userRole.createMany({
    data: [
      { tenantId: tenant.id, userId: allUsers[0].id, roleId: adminRole!.id },
      { tenantId: tenant.id, userId: allUsers[1].id, roleId: managerRole!.id },
      { tenantId: tenant.id, userId: allUsers[2].id, roleId: salesRole!.id },
      { tenantId: tenant.id, userId: allUsers[3].id, roleId: salesRole!.id },
      { tenantId: tenant.id, userId: allUsers[4].id, roleId: cashierRole!.id },
    ],
  });

  // ─── CATEGORIES ─────────────────────────────────────────
  const categories = await prisma.category.createMany({
    data: [
      { tenantId: tenant.id, name: 'Electronics', description: 'Electronic devices and accessories' },
      { tenantId: tenant.id, name: 'Clothing', description: 'Apparel and fashion' },
      { tenantId: tenant.id, name: 'Food & Beverage', description: 'Consumable goods' },
      { tenantId: tenant.id, name: 'Home & Garden', description: 'Household items' },
    ],
  });
  console.log(`✅ Categories created: ${categories.count}`);

  const electronics = await prisma.category.findFirst({ where: { tenantId: tenant.id, name: 'Electronics' } });
  const clothing = await prisma.category.findFirst({ where: { tenantId: tenant.id, name: 'Clothing' } });
  const food = await prisma.category.findFirst({ where: { tenantId: tenant.id, name: 'Food & Beverage' } });

  // ─── UNITS ──────────────────────────────────────────────
  const units = await prisma.unit.createMany({
    data: [
      { tenantId: tenant.id, name: 'Piece', symbol: 'pcs' },
      { tenantId: tenant.id, name: 'Kilogram', symbol: 'kg' },
      { tenantId: tenant.id, name: 'Box', symbol: 'box' },
      { tenantId: tenant.id, name: 'Liter', symbol: 'L' },
    ],
  });
  console.log(`✅ Units created: ${units.count}`);

  const piece = await prisma.unit.findFirst({ where: { tenantId: tenant.id, symbol: 'pcs' } });
  const kg = await prisma.unit.findFirst({ where: { tenantId: tenant.id, symbol: 'kg' } });

  // ─── PRODUCTS ───────────────────────────────────────────
  const products = await prisma.product.createMany({
    data: [
      { tenantId: tenant.id, sku: 'ELEC-001', name: 'Wireless Headphones', barcode: '1234567890123', categoryId: electronics!.id, unitId: piece!.id, basePrice: 79.99, costPrice: 45.00, taxRate: 10, trackInventory: true, minStock: 10, maxStock: 100, isActive: true },
      { tenantId: tenant.id, sku: 'ELEC-002', name: 'Bluetooth Speaker', barcode: '1234567890124', categoryId: electronics!.id, unitId: piece!.id, basePrice: 49.99, costPrice: 28.00, taxRate: 10, trackInventory: true, minStock: 15, maxStock: 150, isActive: true },
      { tenantId: tenant.id, sku: 'ELEC-003', name: 'USB-C Cable 2m', barcode: '1234567890125', categoryId: electronics!.id, unitId: piece!.id, basePrice: 12.99, costPrice: 4.50, taxRate: 10, trackInventory: true, minStock: 50, maxStock: 500, isActive: true },
      { tenantId: tenant.id, sku: 'CLTH-001', name: 'Cotton T-Shirt', barcode: '1234567890126', categoryId: clothing!.id, unitId: piece!.id, basePrice: 24.99, costPrice: 10.00, taxRate: 10, trackInventory: true, minStock: 20, maxStock: 200, isActive: true },
      { tenantId: tenant.id, sku: 'CLTH-002', name: 'Denim Jeans', barcode: '1234567890127', categoryId: clothing!.id, unitId: piece!.id, basePrice: 59.99, costPrice: 25.00, taxRate: 10, trackInventory: true, minStock: 15, maxStock: 100, isActive: true },
      { tenantId: tenant.id, sku: 'FOOD-001', name: 'Organic Coffee Beans 500g', barcode: '1234567890128', categoryId: food!.id, unitId: kg!.id, basePrice: 18.99, costPrice: 9.00, taxRate: 5, trackInventory: true, minStock: 20, maxStock: 200, isActive: true },
      { tenantId: tenant.id, sku: 'FOOD-002', name: 'Green Tea 100g', barcode: '1234567890129', categoryId: food!.id, unitId: kg!.id, basePrice: 8.99, costPrice: 4.00, taxRate: 5, trackInventory: true, minStock: 30, maxStock: 300, isActive: true },
    ],
  });
  console.log(`✅ Products created: ${products.count}`);

  // ─── INVENTORY ──────────────────────────────────────────
  const allProducts = await prisma.product.findMany({ where: { tenantId: tenant.id } });
  for (const product of allProducts) {
    await prisma.inventory.create({
      data: {
        tenantId: tenant.id,
        productId: product.id,
        quantity: 50,
        reserved: 0,
      },
    });
  }
  console.log(`✅ Inventory initialized for ${allProducts.length} products`);

  // ─── CUSTOMERS ──────────────────────────────────────────
  const customers = await prisma.customer.createMany({
    data: [
      { tenantId: tenant.id, name: 'Acme Corporation', email: 'contact@acme.com', phone: '+1-555-0101', address: '123 Business Ave', city: 'New York', state: 'NY', country: 'USA', creditLimit: 5000, category: 'VIP' },
      { tenantId: tenant.id, name: 'Global Traders Ltd', email: 'info@globaltraders.com', phone: '+1-555-0102', address: '456 Commerce St', city: 'Los Angeles', state: 'CA', country: 'USA', creditLimit: 10000, category: 'VIP' },
      { tenantId: tenant.id, name: 'Corner Store', email: 'owner@cornerstore.com', phone: '+1-555-0103', address: '789 Main St', city: 'Chicago', state: 'IL', country: 'USA', creditLimit: 1000, category: 'Regular' },
      { tenantId: tenant.id, name: 'Metro Retail', email: 'buying@metroretail.com', phone: '+1-555-0104', address: '321 Market Rd', city: 'Houston', state: 'TX', country: 'USA', creditLimit: 3000, category: 'Regular' },
      { tenantId: tenant.id, name: 'Quick Mart', email: 'quick@mart.com', phone: '+1-555-0105', address: '654 Speedy Ln', city: 'Phoenix', state: 'AZ', country: 'USA', creditLimit: 500, category: 'Regular' },
    ],
  });
  console.log(`✅ Customers created: ${customers.count}`);

  // ─── SAMPLE ORDERS ──────────────────────────────────────
  const customerList = await prisma.customer.findMany({ where: { tenantId: tenant.id } });
  const salesRep = allUsers[2]; // John Salesman

  const sampleOrder = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      orderNumber: 'ORD-202608-00001',
      customerId: customerList[0].id,
      salesRepId: salesRep.id,
      status: 'APPROVED',
      source: 'SALES_APP',
      subtotal: 154.97,
      taxAmount: 15.50,
      discount: 0,
      total: 170.47,
      paidAmount: 170.47,
      balanceDue: 0,
      notes: 'Sample order for testing',
      approvedBy: allUsers[0].id,
      approvedAt: new Date(),
      items: {
        create: [
          { productId: allProducts[0].id, quantity: 1, unitPrice: 79.99, taxRate: 10, taxAmount: 8.00, total: 87.99 },
          { productId: allProducts[2].id, quantity: 2, unitPrice: 12.99, taxRate: 10, taxAmount: 2.60, total: 28.58 },
          { productId: allProducts[3].id, quantity: 1, unitPrice: 24.99, taxRate: 10, taxAmount: 2.50, total: 27.49 },
        ],
      },
      payments: {
        create: [
          { amount: 170.47, method: 'BANK_TRANSFER', reference: 'TXN-12345', createdBy: salesRep.id },
        ],
      },
    },
  });
  console.log(`✅ Sample order created: ${sampleOrder.orderNumber}`);

  // ─── AUDIT LOGS ─────────────────────────────────────────
  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      userId: allUsers[0].id,
      action: 'CREATE',
      entityType: 'tenant',
      entityId: tenant.id,
      newValues: tenant,
    },
  });

  console.log('\n🎉 Database seed completed successfully!');
  console.log('\n📋 Login credentials:');
  console.log('   admin@demo.com / password123 (Admin)');
  console.log('   manager@demo.com / password123 (Manager)');
  console.log('   sales1@demo.com / password123 (Sales Rep)');
  console.log('   cashier@demo.com / password123 (Cashier)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
