import { query } from '../database/connection.js';

/**
 * Centralized pricing engine.
 * Determines the final unit price based on business, customer, product, and quantity.
 * NEVER trusts frontend-supplied prices.
 */
export const getProductPrice = async ({ businessId, customerId, productId, quantity = 1 }) => {
  // 1. Get customer to determine price level
  let priceLevelId = null;
  let customerType = 'b2c';

  if (customerId) {
    const custResult = await query(
      `SELECT c.customer_type, cpl.price_level_id
       FROM customers c
       LEFT JOIN customer_price_levels cpl ON cpl.customer_id = c.id AND cpl.business_id = c.business_id AND cpl.is_active = true
       WHERE c.id = $1 AND c.business_id = $2`,
      [customerId, businessId]
    );
    if (custResult.rows.length > 0) {
      customerType = custResult.rows[0].customer_type;
      priceLevelId = custResult.rows[0].price_level_id;
    }
  }

  // 2. If no customer-specific price level, use default based on customer type
  if (!priceLevelId) {
    let levelCode = 'retail';
    if (customerType === 'b2b') levelCode = 'wholesale';
    if (customerType === 'dealer') levelCode = 'dealer';

    const levelResult = await query(
      `SELECT id FROM price_levels WHERE business_id = $1 AND code = $2 AND is_active = true`,
      [businessId, levelCode]
    );
    if (levelResult.rows.length > 0) {
      priceLevelId = levelResult.rows[0].id;
    }
  }

  // 3. Get base price from product_prices
  let basePrice = 0;
  if (priceLevelId) {
    const ppResult = await query(
      `SELECT price FROM product_prices
       WHERE business_id = $1 AND product_id = $2 AND price_level_id = $3 AND is_active = true`,
      [businessId, productId, priceLevelId]
    );
    if (ppResult.rows.length > 0) {
      basePrice = parseFloat(ppResult.rows[0].price);
    }
  }

  // Fallback to product retail price if no price level price found
  if (basePrice === 0) {
    const prodResult = await query(
      `SELECT price FROM products WHERE id = $1 AND business_id = $2`,
      [productId, businessId]
    );
    if (prodResult.rows.length > 0) {
      basePrice = parseFloat(prodResult.rows[0].price);
    }
  }

  // 4. Check quantity-based pricing rules (tier pricing)
  let finalPrice = basePrice;
  if (priceLevelId && quantity > 1) {
    const tierResult = await query(
      `SELECT unit_price FROM quantity_price_rules
       WHERE business_id = $1 AND product_id = $2 AND price_level_id = $3
         AND is_active = true AND min_quantity <= $4
         AND (max_quantity IS NULL OR max_quantity >= $4)
       ORDER BY min_quantity DESC LIMIT 1`,
      [businessId, productId, priceLevelId, quantity]
    );
    if (tierResult.rows.length > 0) {
      finalPrice = parseFloat(tierResult.rows[0].unit_price);
    }
  }

  return {
    unitPrice: finalPrice,
    basePrice,
    priceLevelId,
    customerType,
    quantity
  };
};

/**
 * Calculate order item prices for all items in an order.
 */
export const calculateOrderPrices = async ({ businessId, customerId, items }) => {
  const pricedItems = [];
  let subtotal = 0;

  for (const item of items) {
    const pricing = await getProductPrice({
      businessId,
      customerId,
      productId: item.productId,
      quantity: item.quantity
    });

    const totalPrice = pricing.unitPrice * item.quantity;
    subtotal += totalPrice;

    pricedItems.push({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: pricing.unitPrice,
      totalPrice,
      priceLevelId: pricing.priceLevelId
    });
  }

  return { pricedItems, subtotal };
};

// Price Level CRUD
export const getPriceLevels = async (businessId) => {
  const result = await query(
    `SELECT * FROM price_levels WHERE business_id = $1 ORDER BY name`,
    [businessId]
  );
  return result.rows;
};

export const getPriceLevelById = async (id, businessId) => {
  const result = await query(
    `SELECT * FROM price_levels WHERE id = $1 AND business_id = $2`,
    [id, businessId]
  );
  return result.rows[0] || null;
};

export const createPriceLevel = async (data, businessId) => {
  const result = await query(
    `INSERT INTO price_levels (business_id, name, code, description, is_default, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [businessId, data.name, data.code, data.description || null, data.isDefault || false, data.isActive !== undefined ? data.isActive : true]
  );
  return result.rows[0];
};

export const updatePriceLevel = async (id, data, businessId) => {
  const result = await query(
    `UPDATE price_levels SET name = $1, code = $2, description = $3, is_default = $4, is_active = $5
     WHERE id = $6 AND business_id = $7 RETURNING *`,
    [data.name, data.code, data.description || null, data.isDefault || false,
     data.isActive !== undefined ? data.isActive : true, id, businessId]
  );
  return result.rows[0] || null;
};

export const deletePriceLevel = async (id, businessId) => {
  const result = await query(
    `DELETE FROM price_levels WHERE id = $1 AND business_id = $2 RETURNING id`,
    [id, businessId]
  );
  return result.rowCount > 0;
};

// Product Price CRUD
export const getProductPrices = async (productId, businessId) => {
  const result = await query(
    `SELECT pp.*, pl.name as price_level_name, pl.code as price_level_code
     FROM product_prices pp
     JOIN price_levels pl ON pp.price_level_id = pl.id
     WHERE pp.product_id = $1 AND pp.business_id = $2`,
    [productId, businessId]
  );
  return result.rows;
};

export const setProductPrice = async (data, businessId) => {
  const result = await query(
    `INSERT INTO product_prices (business_id, product_id, price_level_id, price, is_active)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (business_id, product_id, price_level_id)
     DO UPDATE SET price = EXCLUDED.price, is_active = EXCLUDED.is_active, updated_at = NOW()
     RETURNING *`,
    [businessId, data.productId, data.priceLevelId, data.price, data.isActive !== undefined ? data.isActive : true]
  );
  return result.rows[0];
};

export const deleteProductPrice = async (id, businessId) => {
  const result = await query(
    `DELETE FROM product_prices WHERE id = $1 AND business_id = $2 RETURNING id`,
    [id, businessId]
  );
  return result.rowCount > 0;
};

// Quantity Price Rules CRUD
export const getQuantityRules = async (productId, businessId) => {
  const result = await query(
    `SELECT qpr.*, pl.name as price_level_name, pl.code as price_level_code
     FROM quantity_price_rules qpr
     JOIN price_levels pl ON qpr.price_level_id = pl.id
     WHERE qpr.product_id = $1 AND qpr.business_id = $2 AND qpr.is_active = true
     ORDER BY qpr.min_quantity`,
    [productId, businessId]
  );
  return result.rows;
};

export const createQuantityRule = async (data, businessId) => {
  const result = await query(
    `INSERT INTO quantity_price_rules (business_id, product_id, price_level_id, min_quantity, max_quantity, unit_price, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [businessId, data.productId, data.priceLevelId, data.minQuantity, data.maxQuantity || null, data.unitPrice,
     data.isActive !== undefined ? data.isActive : true]
  );
  return result.rows[0];
};

export const updateQuantityRule = async (id, data, businessId) => {
  const result = await query(
    `UPDATE quantity_price_rules SET min_quantity = $1, max_quantity = $2, unit_price = $3, is_active = $4
     WHERE id = $5 AND business_id = $6 RETURNING *`,
    [data.minQuantity, data.maxQuantity || null, data.unitPrice,
     data.isActive !== undefined ? data.isActive : true, id, businessId]
  );
  return result.rows[0] || null;
};

export const deleteQuantityRule = async (id, businessId) => {
  const result = await query(
    `DELETE FROM quantity_price_rules WHERE id = $1 AND business_id = $2 RETURNING id`,
    [id, businessId]
  );
  return result.rowCount > 0;
};

// Customer Price Level
export const getCustomerPriceLevel = async (customerId, businessId) => {
  const result = await query(
    `SELECT cpl.*, pl.name as price_level_name, pl.code as price_level_code
     FROM customer_price_levels cpl
     JOIN price_levels pl ON cpl.price_level_id = pl.id
     WHERE cpl.customer_id = $1 AND cpl.business_id = $2 AND cpl.is_active = true`,
    [customerId, businessId]
  );
  return result.rows[0] || null;
};

export const setCustomerPriceLevel = async (customerId, priceLevelId, businessId) => {
  const result = await query(
    `INSERT INTO customer_price_levels (business_id, customer_id, price_level_id, is_active)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (business_id, customer_id)
     DO UPDATE SET price_level_id = EXCLUDED.price_level_id, is_active = true, updated_at = NOW()
     RETURNING *`,
    [businessId, customerId, priceLevelId]
  );
  return result.rows[0];
};
