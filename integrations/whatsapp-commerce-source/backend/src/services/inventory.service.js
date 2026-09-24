import { query, getPool } from '../database/connection.js';

/**
 * Get inventory overview for all products in a business.
 */
export const getInventory = async (businessId, filters = {}) => {
  let sql = `SELECT p.id, p.name, p.sku, p.stock_quantity, p.low_stock_threshold,
             p.is_active, c.name as category_name,
             CASE
               WHEN p.stock_quantity <= 0 THEN 'out_of_stock'
               WHEN p.stock_quantity <= p.low_stock_threshold THEN 'low_stock'
               ELSE 'in_stock'
             END as stock_status
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.business_id = $1`;
  const params = [businessId];
  let idx = 2;

  if (filters.status) {
    if (filters.status === 'low_stock') {
      sql += ` AND p.stock_quantity <= p.low_stock_threshold AND p.stock_quantity > 0`;
    } else if (filters.status === 'out_of_stock') {
      sql += ` AND p.stock_quantity <= 0`;
    } else if (filters.status === 'in_stock') {
      sql += ` AND p.stock_quantity > p.low_stock_threshold`;
    }
  }

  if (filters.search) {
    sql += ` AND (p.name ILIKE $${idx} OR p.sku ILIKE $${idx})`;
    params.push(`%${filters.search}%`);
    idx++;
  }

  sql += ` ORDER BY p.stock_quantity ASC, p.name`;
  const result = await query(sql, params);
  return result.rows;
};

/**
 * Get inventory for a single product.
 */
export const getInventoryByProduct = async (productId, businessId) => {
  const result = await query(
    `SELECT p.id, p.name, p.sku, p.stock_quantity, p.low_stock_threshold, p.is_active,
            c.name as category_name,
            CASE
              WHEN p.stock_quantity <= 0 THEN 'out_of_stock'
              WHEN p.stock_quantity <= p.low_stock_threshold THEN 'low_stock'
              ELSE 'in_stock'
            END as stock_status
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.id = $1 AND p.business_id = $2`,
    [productId, businessId]
  );
  return result.rows[0] || null;
};

/**
 * Get inventory movement history for a product.
 */
export const getInventoryMovements = async (productId, businessId, limit = 50) => {
  const result = await query(
    `SELECT im.*, u.full_name as created_by_name
     FROM inventory_movements im
     LEFT JOIN users u ON im.created_by = u.id
     WHERE im.product_id = $1 AND im.business_id = $2
     ORDER BY im.created_at DESC
     LIMIT $3`,
    [productId, businessId, limit]
  );
  return result.rows;
};

/**
 * Adjust stock with transaction safety and row locking.
 * Creates an inventory_movements record.
 */
export const adjustStock = async ({ productId, quantityChange, reason, referenceType, referenceId, userId, businessId }) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Lock the product row to prevent race conditions
    const lockResult = await client.query(
      `SELECT stock_quantity FROM products WHERE id = $1 AND business_id = $2 FOR UPDATE`,
      [productId, businessId]
    );

    if (lockResult.rows.length === 0) {
      throw new Error('Product not found in this business.');
    }

    const currentStock = lockResult.rows[0].stock_quantity;
    const newStock = currentStock + quantityChange;

    // Check negative stock setting if reducing stock
    if (quantityChange < 0 && newStock < 0) {
      const settingResult = await client.query(
        `SELECT value FROM settings WHERE key = 'allow_negative_stock' AND business_id = $1`,
        [businessId]
      );
      const allowNegative = settingResult.rows[0]?.value === 'true';
      if (!allowNegative) {
        throw new Error(`Insufficient stock. Current: ${currentStock}, Requested: ${Math.abs(quantityChange)}`);
      }
    }

    // Update product stock
    await client.query(
      `UPDATE products SET stock_quantity = $1 WHERE id = $2 AND business_id = $3`,
      [newStock, productId, businessId]
    );

    // Determine movement type
    let movementType = 'ADJUSTMENT';
    if (quantityChange > 0) {
      if (referenceType === 'order') movementType = 'RETURN';
      else if (referenceType === 'purchase') movementType = 'PURCHASE';
      else if (referenceType === 'restock') movementType = 'RESTOCK';
      else if (referenceType === 'transfer') movementType = 'TRANSFER';
      else movementType = 'RESTOCK';
    } else if (quantityChange < 0) {
      if (referenceType === 'order') movementType = 'SALE';
      else if (referenceType === 'damage') movementType = 'DAMAGE';
      else if (referenceType === 'transfer') movementType = 'TRANSFER';
      else movementType = 'ADJUSTMENT';
    }

    // Record movement
    const movementResult = await client.query(
      `INSERT INTO inventory_movements (business_id, product_id, quantity_change, reason, reference_type, reference_id, movement_type, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [businessId, productId, quantityChange, reason || null, referenceType || null, referenceId || null,
       movementType, reason || null, userId || null]
    );

    await client.query('COMMIT');
    return {
      productId,
      previousStock: currentStock,
      newStock,
      quantityChange,
      movement: movementResult.rows[0]
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Reserve stock for an order (used during order creation).
 * Uses FOR UPDATE to prevent race conditions between concurrent orders.
 */
export const reserveStock = async ({ productId, quantity, orderId, userId, businessId }) => {
  return adjustStock({
    productId,
    quantityChange: -quantity,
    reason: `Order reservation #${orderId}`,
    referenceType: 'order',
    referenceId: orderId,
    userId,
    businessId
  });
};

/**
 * Restore stock when an order is cancelled.
 */
export const restoreStock = async ({ productId, quantity, orderId, userId, businessId }) => {
  return adjustStock({
    productId,
    quantityChange: quantity,
    reason: `Order cancellation #${orderId}`,
    referenceType: 'order',
    referenceId: orderId,
    userId,
    businessId
  });
};

/**
 * Check if sufficient stock is available for a set of items.
 * Uses FOR UPDATE to lock rows during the check.
 */
export const checkStockAvailability = async (items, businessId) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const results = [];
    for (const item of items) {
      const result = await client.query(
        `SELECT id, name, sku, stock_quantity FROM products WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [item.productId, businessId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Product ${item.productId} not found.`);
      }

      const product = result.rows[0];
      const available = product.stock_quantity >= item.quantity;

      results.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        requested: item.quantity,
        available: product.stock_quantity,
        sufficient: available
      });

      if (!available) {
        throw new Error(`Insufficient stock for ${product.name} (SKU: ${product.sku}). Available: ${product.stock_quantity}, Requested: ${item.quantity}`);
      }
    }

    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get low stock products.
 */
export const getLowStock = async (businessId) => {
  const result = await query(
    `SELECT p.id, p.name, p.sku, p.stock_quantity, p.low_stock_threshold, c.name as category_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.business_id = $1 AND p.stock_quantity <= p.low_stock_threshold AND p.is_active = true
     ORDER BY p.stock_quantity ASC`,
    [businessId]
  );
  return result.rows;
};
