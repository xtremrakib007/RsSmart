import { query } from '../database/connection.js';

export const STATES = {
  MAIN_MENU: 'MAIN_MENU',
  BROWSING_PRODUCTS: 'BROWSING_PRODUCTS',
  VIEWING_PRODUCT: 'VIEWING_PRODUCT',
  SELECTING_QUANTITY: 'SELECTING_QUANTITY',
  CART: 'CART',
  CHECKOUT: 'CHECKOUT',
  SELECTING_ADDRESS: 'SELECTING_ADDRESS',
  ADDING_ADDRESS: 'ADDING_ADDRESS',
  ORDER_CONFIRMATION: 'ORDER_CONFIRMATION',
  VIEWING_ORDERS: 'VIEWING_ORDERS',
  VIEWING_ORDER: 'VIEWING_ORDER',
  SEARCHING_PRODUCTS: 'SEARCHING_PRODUCTS',
  VIEWING_ACCOUNT: 'VIEWING_ACCOUNT',
  WAITING_FOR_STAFF: 'WAITING_FOR_STAFF',
  STAFF_HANDLING: 'STAFF_HANDLING',
};

export const getState = async (businessId, customerId, conversationId) => {
  const result = await query(
    `SELECT * FROM whatsapp_conversation_states
     WHERE business_id = $1 AND customer_id = $2 AND conversation_id = $3`,
    [businessId, customerId, conversationId]
  );

  if (result.rows.length > 0) {
    return result.rows[0];
  }

  // Create default state
  const insertResult = await query(
    `INSERT INTO whatsapp_conversation_states (business_id, customer_id, conversation_id, state, state_data)
     VALUES ($1, $2, $3, 'MAIN_MENU', '{}')
     RETURNING *`,
    [businessId, customerId, conversationId]
  );

  return insertResult.rows[0];
};

export const setState = async (businessId, customerId, conversationId, state, stateData = {}) => {
  const result = await query(
    `INSERT INTO whatsapp_conversation_states (business_id, customer_id, conversation_id, state, state_data, last_activity_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (business_id, customer_id, conversation_id)
     DO UPDATE SET state = EXCLUDED.state, state_data = EXCLUDED.state_data, last_activity_at = NOW(), updated_at = NOW()
     RETURNING *`,
    [businessId, customerId, conversationId, state, JSON.stringify(stateData)]
  );
  return result.rows[0];
};

export const updateStateData = async (businessId, customerId, conversationId, updater) => {
  const current = await getState(businessId, customerId, conversationId);
  const newData = typeof updater === 'function' ? updater(current.state_data || {}) : { ...current.state_data, ...updater };

  const result = await query(
    `UPDATE whatsapp_conversation_states
     SET state_data = $1, last_activity_at = NOW(), updated_at = NOW()
     WHERE business_id = $2 AND customer_id = $3 AND conversation_id = $4
     RETURNING *`,
    [JSON.stringify(newData), businessId, customerId, conversationId]
  );
  return result.rows[0];
};

export const setStaffHandling = async (businessId, customerId, conversationId, staffUserId = null) => {
  const result = await query(
    `UPDATE whatsapp_conversation_states
     SET staff_handling = $1, staff_user_id = $2, last_activity_at = NOW(), updated_at = NOW()
     WHERE business_id = $3 AND customer_id = $4 AND conversation_id = $5
     RETURNING *`,
    [!!staffUserId, staffUserId, businessId, customerId, conversationId]
  );
  return result.rows[0];
};

export const isStaffHandling = async (businessId, customerId, conversationId) => {
  const state = await getState(businessId, customerId, conversationId);
  return state.staff_handling;
};

export const resetToMainMenu = async (businessId, customerId, conversationId) => {
  return await setState(businessId, customerId, conversationId, STATES.MAIN_MENU, {});
};
