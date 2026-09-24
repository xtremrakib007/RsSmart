import { getPool } from '../database/connection.js';
import { getProductPrice } from './pricing.service.js';

/**
 * Checkout flow - fully transactional.
 * 
 * 1. Validate cart
 * 2. Lock products (FOR UPDATE)
 * 3. Recalculate all prices
 * 4. Check stock
 * 5. Generate order number
 * 6. Create order with snapshots
 * 7. Create order items with snapshots
 * 8. Reserve inventory (create movement records)
 * 9. Create payment record (UNPAID)
 * 10. Clear cart
 * 11. Commit or rollback everything
 */
export const checkout = async ({ businessId, customerId, deliveryAddressId, deliveryMethod, notes, userId }) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── 1. Get cart with lock ──
    const cartResult = await client.query(
      `SELECT c.id, c.customer_id FROM carts c
       WHERE c.business_id = $1 AND c.customer_id = $2 FOR UPDATE`,
      [businessId, customerId]
    );
    if (cartResult.rows.length === 0) {
      throw new Error('Cart not found.');
    }
    const cartId = cartResult.rows[0].id;

    // ── 2. Get cart items ──
    const itemsResult = await client.query(
      `SELECT ci.*, p.id as product_id, p.name as product_name, p.sku as product_sku,
              p.stock_quantity, p.is_active, p.cost
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = $1`,
      [cartId]
    );
    const cartItems = itemsResult.rows;
    if (cartItems.length === 0) {
      throw new Error('Cart is empty.');
    }

    // ── 3. Verify customer belongs to business ──
    const custResult = await client.query(
      `SELECT id, customer_type, full_name FROM customers WHERE id = $1 AND business_id = $2`,
      [customerId, businessId]
    );
    if (custResult.rows.length === 0) {
      throw new Error('Customer not found in this business.');
    }
    const customerType = custResult.rows[0].customer_type;
    const customerName = custResult.rows[0].full_name;

    // ── 4. Lock all products and validate ──
    const productIds = cartItems.map(i => i.product_id);
    const lockedProducts = await client.query(
      `SELECT id, stock_quantity, is_active, name FROM products
       WHERE id = ANY($1) AND business_id = $2 FOR UPDATE`,
      [productIds, businessId]
    );
    const productMap = {};
    lockedProducts.rows.forEach(p => { productMap[p.id] = p; });

    const validationErrors = [];
    for (const item of cartItems) {
      const product = productMap[item.product_id];
      if (!product) {
        validationErrors.push(`${item.product_name}: Product no longer exists.`);
        continue;
      }
      if (!product.is_active) {
        validationErrors.push(`${product.name}: Product is no longer active.`);
      }
      if (product.stock_quantity < item.quantity) {
        validationErrors.push(`${product.name}: Insufficient stock. Available: ${product.stock_quantity}, Requested: ${item.quantity}.`);
      }
    }
    if (validationErrors.length > 0) {
      throw new Error(`VALIDATION_FAILED: ${validationErrors.join('; ')}`);
    }

    // ── 5. Recalculate prices (NEVER trust cart prices) ──
    let orderSubtotal = 0;
    const pricedItems = [];
    for (const item of cartItems) {
      const pricing = await getProductPrice({
        businessId,
        customerId,
        productId: item.product_id,
        quantity: item.quantity
      });
      const unitPrice = pricing.unitPrice;
      const itemSubtotal = unitPrice * item.quantity;
      orderSubtotal += itemSubtotal;

      pricedItems.push({
        productId: item.product_id,
        productName: item.product_name,
        productSku: item.product_sku,
        quantity: item.quantity,
        unitPrice,
        totalPrice: itemSubtotal,
        priceLevelId: pricing.priceLevelId,
        cost: item.cost || 0
      });
    }

    // ── 6. Calculate totals ──
    const taxAmount = 0; // Tax calculation can be added later
    const discountAmount = 0;
    // Get delivery fee from settings or calculate based on method
    let shippingAmount = 0;
    if (deliveryMethod === 'delivery') {
      const deliverySetting = await client.query(
        `SELECT value FROM settings WHERE key = 'delivery_fee' AND business_id = $1`,
        [businessId]
      );
      shippingAmount = parseFloat(deliverySetting.rows[0]?.value || 0);
    }
    const totalAmount = orderSubtotal + taxAmount - discountAmount + shippingAmount;

    // ── 7. Get delivery address ──
    let deliveryAddress = null;
    let deliveryCity = null;
    let deliveryCountry = 'Malaysia';
    let deliveryPhone = null;

    if (deliveryAddressId) {
      const addrResult = await client.query(
        `SELECT * FROM delivery_addresses WHERE id = $1 AND business_id = $2 AND customer_id = $3`,
        [deliveryAddressId, businessId, customerId]
      );
      if (addrResult.rows.length > 0) {
        const addr = addrResult.rows[0];
        deliveryAddress = addr.address;
        deliveryCity = addr.city;
        deliveryCountry = addr.country;
        deliveryPhone = addr.phone;
      }
    }

    // ── 8. Generate order number ──
    const orderPrefixResult = await client.query(
      `SELECT value FROM settings WHERE key = 'order_prefix' AND business_id = $1`,
      [businessId]
    );
    const prefix = orderPrefixResult.rows[0]?.value || 'ORD-';
    const countResult = await client.query(
      `SELECT COUNT(*) as count FROM orders WHERE business_id = $1`,
      [businessId]
    );
    const orderNumber = `${prefix}${String(parseInt(countResult.rows[0].count) + 1).padStart(6, '0')}`;

    // ── 9. Create order ──
    const orderResult = await client.query(
      `INSERT INTO orders (
        business_id, customer_id, customer_type, status, subtotal, tax_amount,
        discount_amount, shipping_amount, total_amount, currency, notes,
        delivery_address, delivery_city, delivery_country, delivery_phone,
        created_by, source, order_number
      ) VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        businessId, customerId, customerType, orderSubtotal, taxAmount,
        discountAmount, shippingAmount, totalAmount, 'MYR', notes || null,
        deliveryAddress, deliveryCity, deliveryCountry, deliveryPhone,
        userId || null, 'web', orderNumber
      ]
    );
    const order = orderResult.rows[0];

    // ── 10. Create order items with snapshots ──
    for (const item of pricedItems) {
      await client.query(
        `INSERT INTO order_items (
          order_id, product_id, product_name, product_sku, quantity,
          unit_price, total_price, price_level_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          order.id, item.productId, item.productName, item.productSku,
          item.quantity, item.unitPrice, item.totalPrice, item.priceLevelId
        ]
      );

      // ── 11. Reserve inventory ──
      await client.query(
        `UPDATE products SET stock_quantity = stock_quantity - $1
         WHERE id = $2 AND business_id = $3`,
        [item.quantity, item.productId, businessId]
      );

      // Record inventory movement
      await client.query(
        `INSERT INTO inventory_movements (
          business_id, product_id, quantity_change, movement_type,
          reference_type, reference_id, reason, created_by
        ) VALUES ($1, $2, $3, 'SALE', 'order', $4, $5, $6)`,
        [businessId, item.productId, -item.quantity, order.id, `Order ${orderNumber}`, userId || null]
      );
    }

    // ── 12. Create payment record (UNPAID) ──
    await client.query(
      `INSERT INTO payments (
        business_id, order_id, amount, currency, method, status
      ) VALUES ($1, $2, $3, $4, $5, 'UNPAID')`,
      [businessId, order.id, totalAmount, 'MYR', deliveryMethod === 'pickup' ? 'cash_on_pickup' : 'cash_on_delivery']
    );

    // ── 13. Create order status history ──
    await client.query(
      `INSERT INTO order_status_history (order_id, new_status, changed_by, notes)
       VALUES ($1, 'pending', $2, 'Order created via checkout')`,
      [order.id, userId || null]
    );

    // ── 14. Clear cart ──
    await client.query(`DELETE FROM cart_items WHERE cart_id = $1`, [cartId]);
    await client.query(`DELETE FROM carts WHERE id = $1`, [cartId]);

    // ── 15. Update customer stats ──
    await client.query(
      `UPDATE customers SET total_orders = total_orders + 1, total_spent = total_spent + $1
       WHERE id = $2 AND business_id = $3`,
      [totalAmount, customerId, businessId]
    );

    await client.query('COMMIT');

    return {
      order,
      orderItems: pricedItems,
      totalAmount,
      message: 'Checkout successful. Order created.'
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
