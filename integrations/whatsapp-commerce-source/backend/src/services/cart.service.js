import { query, getPool } from '../database/connection.js';
import { getProductPrice } from './pricing.service.js';

/**
 * Get or create cart for a customer in a business.
 */
export const getOrCreateCart = async (businessId, customerId) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let result = await client.query(
      `SELECT id FROM carts WHERE business_id = $1 AND customer_id = $2 FOR UPDATE`,
      [businessId, customerId]
    );
    let cartId;
    if (result.rows.length === 0) {
      const createResult = await client.query(
        `INSERT INTO carts (business_id, customer_id) VALUES ($1, $2) RETURNING id`,
        [businessId, customerId]
      );
      cartId = createResult.rows[0].id;
    } else {
      cartId = result.rows[0].id;
    }
    await client.query('COMMIT');
    return await getCartById(cartId, businessId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const getCartById = async (cartId, businessId) => {
  const cartResult = await query(
    `SELECT c.*, cu.full_name as customer_name, cu.phone as customer_phone, cu.customer_type
     FROM carts c
     JOIN customers cu ON c.customer_id = cu.id
     WHERE c.id = $1 AND c.business_id = $2`,
    [cartId, businessId]
  );
  if (cartResult.rows.length === 0) return null;

  const itemsResult = await query(
    `SELECT ci.*, p.name as product_name, p.sku as product_sku, p.stock_quantity, p.is_active, p.image_url
     FROM cart_items ci
     JOIN products p ON ci.product_id = p.id
     WHERE ci.cart_id = $1
     ORDER BY ci.created_at DESC`,
    [cartId]
  );

  const cart = cartResult.rows[0];
  cart.items = itemsResult.rows;
  cart.total = itemsResult.rows.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
  cart.itemCount = itemsResult.rows.reduce((sum, item) => sum + item.quantity, 0);
  return cart;
};

/**
 * Add item to cart. Backend calculates price via pricing engine.
 */
export const addItemToCart = async ({ businessId, customerId, productId, quantity }) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify product belongs to business and is active
    const productResult = await client.query(
      `SELECT id, name, sku, stock_quantity, is_active FROM products WHERE id = $1 AND business_id = $2 FOR UPDATE`,
      [productId, businessId]
    );
    if (productResult.rows.length === 0) {
      throw new Error('Product not found in this business.');
    }
    const product = productResult.rows[0];
    if (!product.is_active) {
      throw new Error('Product is not active.');
    }

    // Get current price from pricing engine
    const pricing = await getProductPrice({ businessId, customerId, productId, quantity });
    const unitPrice = pricing.unitPrice;
    const subtotal = unitPrice * quantity;

    // Get or create cart
    let cartResult = await client.query(
      `SELECT id FROM carts WHERE business_id = $1 AND customer_id = $2`,
      [businessId, customerId]
    );
    let cartId;
    if (cartResult.rows.length === 0) {
      const newCart = await client.query(
        `INSERT INTO carts (business_id, customer_id) VALUES ($1, $2) RETURNING id`,
        [businessId, customerId]
      );
      cartId = newCart.rows[0].id;
    } else {
      cartId = cartResult.rows[0].id;
    }

    // Upsert cart item
    const itemResult = await client.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity, unit_price, subtotal)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (cart_id, product_id)
       DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity,
                     unit_price = EXCLUDED.unit_price,
                     subtotal = (cart_items.quantity + EXCLUDED.quantity) * EXCLUDED.unit_price,
                     updated_at = NOW()
       RETURNING *`,
      [cartId, productId, quantity, unitPrice, subtotal]
    );

    await client.query('COMMIT');
    return { cartItem: itemResult.rows[0], cartId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const updateCartItemQuantity = async ({ cartItemId, quantity, businessId }) => {
  if (quantity < 1) {
    throw new Error('Quantity must be at least 1.');
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify cart item belongs to business
    const itemResult = await client.query(
      `SELECT ci.*, c.business_id, c.customer_id, ci.product_id
       FROM cart_items ci
       JOIN carts c ON ci.cart_id = c.id
       WHERE ci.id = $1 AND c.business_id = $2`,
      [cartItemId, businessId]
    );
    if (itemResult.rows.length === 0) {
      throw new Error('Cart item not found.');
    }
    const item = itemResult.rows[0];

    // Recalculate price with new quantity
    const pricing = await getProductPrice({
      businessId,
      customerId: item.customer_id,
      productId: item.product_id,
      quantity
    });
    const unitPrice = pricing.unitPrice;
    const subtotal = unitPrice * quantity;

    const updateResult = await client.query(
      `UPDATE cart_items SET quantity = $1, unit_price = $2, subtotal = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [quantity, unitPrice, subtotal, cartItemId]
    );

    await client.query('COMMIT');
    return updateResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const removeCartItem = async (cartItemId, businessId) => {
  const result = await query(
    `DELETE FROM cart_items ci USING carts c
     WHERE ci.id = $1 AND ci.cart_id = c.id AND c.business_id = $2
     RETURNING ci.id`,
    [cartItemId, businessId]
  );
  return result.rowCount > 0;
};

export const clearCart = async (cartId, businessId) => {
  const result = await query(
    `DELETE FROM cart_items ci USING carts c
     WHERE ci.cart_id = c.id AND c.id = $1 AND c.business_id = $2`,
    [cartId, businessId]
  );
  return result.rowCount >= 0;
};

export const getCartByCustomer = async (businessId, customerId) => {
  const cartResult = await query(
    `SELECT id FROM carts WHERE business_id = $1 AND customer_id = $2`,
    [businessId, customerId]
  );
  if (cartResult.rows.length === 0) return null;
  return getCartById(cartResult.rows[0].id, businessId);
};

/**
 * Validate entire cart before checkout.
 * Returns validation result with any issues.
 */
export const validateCart = async (cartId, businessId) => {
  const cart = await getCartById(cartId, businessId);
  if (!cart) {
    return { valid: false, errors: ['Cart not found.'], items: [] };
  }
  if (cart.items.length === 0) {
    return { valid: false, errors: ['Cart is empty.'], items: [] };
  }

  const errors = [];
  const validatedItems = [];
  let hasPriceChanges = false;

  for (const item of cart.items) {
    const issues = [];

    // Check product exists and is active
    if (!item.is_active) {
      issues.push('Product is no longer active.');
    }

    // Check stock
    if (item.stock_quantity < item.quantity) {
      issues.push(`Insufficient stock. Available: ${item.stock_quantity}, Requested: ${item.quantity}`);
    }

    // Recalculate current price
    const currentPricing = await getProductPrice({
      businessId,
      customerId: cart.customer_id,
      productId: item.product_id,
      quantity: item.quantity
    });

    const currentUnitPrice = currentPricing.unitPrice;
    const currentSubtotal = currentUnitPrice * item.quantity;
    const storedUnitPrice = parseFloat(item.unit_price);

    if (Math.abs(currentUnitPrice - storedUnitPrice) > 0.001) {
      issues.push(`Price changed from ${storedUnitPrice.toFixed(2)} to ${currentUnitPrice.toFixed(2)}.`);
      hasPriceChanges = true;
    }

    validatedItems.push({
      ...item,
      currentUnitPrice,
      currentSubtotal,
      priceChanged: Math.abs(currentUnitPrice - storedUnitPrice) > 0.001,
      issues
    });

    if (issues.length > 0) {
      errors.push(`${item.product_name}: ${issues.join(' ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    hasPriceChanges,
    items: validatedItems,
    cart
  };
};
