import * as commerceConversation from './commerceConversation.service.js';
import { query } from '../database/connection.js';

/**
 * Route an incoming WhatsApp message to the appropriate handler.
 * Returns { handled: boolean, reason?: string }
 */
export const routeMessage = async (message, customer, conversation, businessId) => {
  const { id: conversationId } = conversation;
  const { id: customerId } = customer;

  try {
    // Check if staff is actively handling this conversation
    const stateResult = await query(
      `SELECT staff_handling FROM whatsapp_conversation_states
       WHERE business_id = $1 AND customer_id = $2 AND conversation_id = $3`,
      [businessId, customerId, conversationId]
    );

    const isStaffHandling = stateResult.rows[0]?.staff_handling || false;

    if (isStaffHandling) {
      // Staff is handling - just store message, don't auto-respond
      return { handled: false, reason: 'staff_handling' };
    }

    // Route to commerce conversation handler
    const result = await commerceConversation.handleMessage(message, customer, conversation, businessId);
    return result;
  } catch (error) {
    console.error('[MessageRouter] Error routing message:', error.message);
    // Don't crash - log and return unhandled so webhook still succeeds
    return { handled: false, reason: 'error', error: error.message };
  }
};
