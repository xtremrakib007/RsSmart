import { query, getPool } from '../database/connection.js';

const VALID_TRANSITIONS = {
  'PENDING': ['READY_FOR_PICKUP', 'PROCESSING', 'CANCELLED'],
  'READY_FOR_PICKUP': ['PICKED_UP', 'CANCELLED'],
  'PROCESSING': ['READY_TO_SHIP', 'CANCELLED'],
  'READY_TO_SHIP': ['SHIPPED', 'CANCELLED'],
  'SHIPPED': ['OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED'],
  'OUT_FOR_DELIVERY': ['DELIVERED', 'FAILED', 'RETURNED'],
  'DELIVERED': ['RETURNED'],
  'FAILED': ['PROCESSING', 'SHIPPED'],
  'RETURNED': [],
  'CANCELLED': []
};

export const isValidTransition = (oldStatus, newStatus) => {
  if (oldStatus === newStatus) return true;
  const allowed = VALID_TRANSITIONS[oldStatus] || [];
  return allowed.includes(newStatus);
};

export const createDelivery = async ({ businessId, orderId, customerId, fulfillmentType, addressSnapshot, deliveryFee, notes }) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify order belongs to business
    const orderCheck = await client.query(
      `SELECT id, customer_id FROM orders WHERE id = $1 AND business_id = $2`,
      [orderId, businessId]
    );
    if (orderCheck.rows.length === 0) throw new Error('Order not found in this business.');

    const result = await client.query(
      `INSERT INTO deliveries (business_id, order_id, customer_id, fulfillment_type, address_snapshot, address_city, address_state, address_postal_code, address_country, delivery_fee, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PENDING')
       RETURNING *`,
      [
        businessId, orderId, customerId, fulfillmentType,
        addressSnapshot?.address || null,
        addressSnapshot?.city || null,
        addressSnapshot?.state || null,
        addressSnapshot?.postalCode || null,
        addressSnapshot?.country || 'Malaysia',
        deliveryFee || 0,
        notes
      ]
    );

    const delivery = result.rows[0];

    await client.query(
      `INSERT INTO delivery_status_history (business_id, delivery_id, new_status, source, reason)
       VALUES ($1, $2, 'PENDING', 'SYSTEM', 'Delivery created')`,
      [businessId, delivery.id]
    );

    await client.query('COMMIT');
    return delivery;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const getDeliveryById = async (id, businessId) => {
  const result = await query(
    `SELECT d.*, o.order_number, c.full_name as customer_name, c.phone as customer_phone
     FROM deliveries d
     LEFT JOIN orders o ON d.order_id = o.id
     LEFT JOIN customers c ON d.customer_id = c.id
     WHERE d.id = $1 AND d.business_id = $2`,
    [id, businessId]
  );
  return result.rows[0] || null;
};

export const getDeliveryByOrder = async (orderId, businessId) => {
  const result = await query(
    `SELECT d.*, o.order_number, c.full_name as customer_name
     FROM deliveries d
     LEFT JOIN orders o ON d.order_id = o.id
     LEFT JOIN customers c ON d.customer_id = c.id
     WHERE d.order_id = $1 AND d.business_id = $2`,
    [orderId, businessId]
  );
  return result.rows[0] || null;
};

export const getAllDeliveries = async (filters = {}, businessId) => {
  let sql = `SELECT d.*, o.order_number, c.full_name as customer_name
             FROM deliveries d
             LEFT JOIN orders o ON d.order_id = o.id
             LEFT JOIN customers c ON d.customer_id = c.id
             WHERE d.business_id = $1`;
  const params = [businessId];
  let idx = 2;

  if (filters.status) { sql += ` AND d.status = $${idx}`; params.push(filters.status); idx++; }
  if (filters.fulfillmentType) { sql += ` AND d.fulfillment_type = $${idx}`; params.push(filters.fulfillmentType); idx++; }
  if (filters.courier) { sql += ` AND d.courier_provider = $${idx}`; params.push(filters.courier); idx++; }
  if (filters.search) { sql += ` AND (c.full_name ILIKE $${idx} OR o.order_number ILIKE $${idx})`; params.push(`%${filters.search}%`); idx++; }

  sql += ` ORDER BY d.created_at DESC`;
  const result = await query(sql, params);
  return result.rows;
};

export const updateDeliveryStatus = async (id, newStatus, { changedBy, source = 'ADMIN', reason, trackingNumber, courierProvider, driverName, driverPhone, estimatedDeliveryDate }) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const currentResult = await client.query(
      `SELECT * FROM deliveries WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (currentResult.rows.length === 0) throw new Error('Delivery not found.');

    const delivery = currentResult.rows[0];
    const oldStatus = delivery.status;

    if (!isValidTransition(oldStatus, newStatus)) {
      throw new Error(`Invalid status transition: ${oldStatus} → ${newStatus}`);
    }

    const updateFields = ['status = $1', 'updated_at = NOW()'];
    const values = [newStatus];
    let paramIdx = 2;

    if (newStatus === 'SHIPPED' || trackingNumber) {
      updateFields.push(`tracking_number = $${paramIdx}`);
      values.push(trackingNumber || delivery.tracking_number);
      paramIdx++;
    }
    if (courierProvider) {
      updateFields.push(`courier_provider = $${paramIdx}`);
      values.push(courierProvider);
      paramIdx++;
    }
    if (driverName) {
      updateFields.push(`driver_name = $${paramIdx}`);
      values.push(driverName);
      paramIdx++;
    }
    if (driverPhone) {
      updateFields.push(`driver_phone = $${paramIdx}`);
      values.push(driverPhone);
      paramIdx++;
    }
    if (estimatedDeliveryDate) {
      updateFields.push(`estimated_delivery_date = $${paramIdx}`);
      values.push(estimatedDeliveryDate);
      paramIdx++;
    }

    // Status-specific timestamps
    if (newStatus === 'SHIPPED') updateFields.push(`shipped_at = NOW()`);
    if (newStatus === 'DELIVERED') updateFields.push(`delivered_at = NOW()`);
    if (newStatus === 'FAILED') updateFields.push(`failed_at = NOW()`);
    if (newStatus === 'RETURNED') updateFields.push(`returned_at = NOW()`);

    values.push(id);

    await client.query(
      `UPDATE deliveries SET ${updateFields.join(', ')} WHERE id = $${paramIdx}`,
      values
    );

    await client.query(
      `INSERT INTO delivery_status_history (business_id, delivery_id, old_status, new_status, changed_by, source, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [delivery.business_id, id, oldStatus, newStatus, changedBy, source, reason]
    );

    await client.query('COMMIT');
    return { ...delivery, status: newStatus };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const markPickupComplete = async (id, { pickedUpBy, pickupReference, changedBy, businessId }) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const delivery = await getDeliveryById(id, businessId);
    if (!delivery) throw new Error('Delivery not found.');
    if (delivery.fulfillment_type !== 'CUSTOMER_PICKUP') {
      throw new Error('This order is not a pickup order.');
    }

    await client.query(
      `UPDATE deliveries SET status = 'DELIVERED', picked_up_by = $1, pickup_reference = $2, picked_up_at = NOW(), updated_at = NOW() WHERE id = $3`,
      [pickedUpBy, pickupReference, id]
    );

    await client.query(
      `INSERT INTO delivery_status_history (business_id, delivery_id, old_status, new_status, changed_by, source, reason)
       VALUES ($1, $2, 'READY_FOR_PICKUP', 'DELIVERED', $3, 'STAFF', 'Customer picked up order')`,
      [businessId, id, changedBy]
    );

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const getDeliveryStatusHistory = async (deliveryId, businessId) => {
  const result = await query(
    `SELECT dsh.*, u.full_name as changed_by_name
     FROM delivery_status_history dsh
     LEFT JOIN users u ON dsh.changed_by = u.id
     WHERE dsh.delivery_id = $1 AND dsh.business_id = $2
     ORDER BY dsh.created_at DESC`,
    [deliveryId, businessId]
  );
  return result.rows;
};

// ============================================
// FULFILLMENT SETTINGS
// ============================================
export const getFulfillmentSettings = async (businessId) => {
  const result = await query(
    `SELECT * FROM fulfillment_settings WHERE business_id = $1`,
    [businessId]
  );
  if (result.rows.length > 0) return result.rows[0];

  // Create default settings
  const insertResult = await query(
    `INSERT INTO fulfillment_settings (business_id) VALUES ($1) RETURNING *`,
    [businessId]
  );
  return insertResult.rows[0];
};

export const updateFulfillmentSettings = async (businessId, data) => {
  const fields = [];
  const values = [];
  let idx = 1;

  const allowedFields = ['pickup_enabled', 'local_delivery_enabled', 'courier_delivery_enabled',
    'free_delivery_threshold', 'flat_delivery_fee', 'delivery_fee_type', 'min_order_for_free_delivery',
    'local_delivery_area', 'business_hours'];

  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      values.push(key === 'business_hours' ? JSON.stringify(data[key]) : data[key]);
      idx++;
    }
  }

  if (fields.length === 0) throw new Error('No valid fields to update.');

  values.push(businessId);
  const result = await query(
    `UPDATE fulfillment_settings SET ${fields.join(', ')}, updated_at = NOW() WHERE business_id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0];
};

export const calculateDeliveryFee = async (businessId, fulfillmentType, cartTotal = 0) => {
  const settings = await getFulfillmentSettings(businessId);

  if (fulfillmentType === 'CUSTOMER_PICKUP') return 0;

  if (settings.delivery_fee_type === 'FREE') return 0;

  if (settings.free_delivery_threshold && parseFloat(cartTotal) >= parseFloat(settings.free_delivery_threshold)) {
    return 0;
  }

  if (settings.delivery_fee_type === 'FLAT_RATE') {
    return parseFloat(settings.flat_delivery_fee || 0);
  }

  // DISTANCE_BASED and AREA_BASED - return flat rate as fallback for now
  return parseFloat(settings.flat_delivery_fee || 0);
};

export const getAvailableFulfillmentMethods = async (businessId) => {
  const settings = await getFulfillmentSettings(businessId);
  const methods = [];
  if (settings.pickup_enabled) methods.push({ type: 'CUSTOMER_PICKUP', name: 'Self Pickup', fee: 0 });
  if (settings.local_delivery_enabled) methods.push({ type: 'LOCAL_DELIVERY', name: 'Local Delivery', fee: settings.flat_delivery_fee });
  if (settings.courier_delivery_enabled) methods.push({ type: 'COURIER_DELIVERY', name: 'Courier Delivery', fee: settings.flat_delivery_fee });
  return methods;
};
