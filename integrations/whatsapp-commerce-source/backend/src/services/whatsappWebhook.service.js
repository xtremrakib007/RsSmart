import { query } from '../database/connection.js';
import { normalizePhone } from '../utils/phone.js';
import { updateMessageStatus } from './whatsappCloudApi.service.js';
import * as customerService from './customer.service.js';

export const isEventProcessed = async (eventId) => {
  if (!eventId) return false;
  const result = await query(
    `SELECT 1 FROM webhook_processed_events WHERE event_id = $1`, [eventId]
  );
  return result.rows.length > 0;
};

export const markEventProcessed = async (eventId, eventType, businessId) => {
  if (!eventId) return;
  await query(
    `INSERT INTO webhook_processed_events (event_id, event_type, business_id) VALUES ($1, $2, $3)
     ON CONFLICT (event_id) DO NOTHING`,
    [eventId, eventType, businessId]
  );
};

export const findOrCreateCustomer = async (phone, businessId, name = null) => {
  const normalizedPhone = normalizePhone(phone);
  let customer = await customerService.getCustomerByPhone(normalizedPhone, businessId);

  if (!customer) {
    customer = await customerService.createCustomer({
      phone: normalizedPhone,
      fullName: name || normalizedPhone,
      country: null
    }, businessId);
  }

  return customer;
};

export const findOrCreateConversation = async (customerId, phone, businessId) => {
  const normalizedPhone = normalizePhone(phone);
  const result = await query(
    `SELECT * FROM whatsapp_conversations WHERE phone = $1 AND business_id = $2 LIMIT 1`,
    [normalizedPhone, businessId]
  );

  if (result.rows.length > 0) {
    return result.rows[0];
  }

  const insertResult = await query(
    `INSERT INTO whatsapp_conversations (customer_id, phone, business_id, last_message, last_message_at, unread_count, is_active)
     VALUES ($1, $2, $3, '', NOW(), 0, true) RETURNING *`,
    [customerId, normalizedPhone, businessId]
  );

  return insertResult.rows[0];
};

export const storeIncomingMessage = async ({
  businessId, conversationId, customerId, phone, messageType, content,
  whatsappMessageId, rawPayload
}) => {
  if (whatsappMessageId) {
    const existing = await query(
      `SELECT 1 FROM whatsapp_messages WHERE whatsapp_message_id = $1 AND direction = 'inbound'`,
      [whatsappMessageId]
    );
    if (existing.rows.length > 0) {
      return null;
    }
  }

  const result = await query(
    `INSERT INTO whatsapp_messages
      (business_id, conversation_id, customer_id, phone, direction, message_type, content, whatsapp_message_id, status, raw_payload)
     VALUES ($1, $2, $3, $4, 'inbound', $5, $6, $7, 'received', $8)
     RETURNING *`,
    [businessId, conversationId, customerId, normalizePhone(phone), messageType, content,
     whatsappMessageId, rawPayload ? JSON.stringify(rawPayload) : null]
  );

  await query(
    `UPDATE whatsapp_conversations
     SET last_message = $1, last_message_at = NOW(), unread_count = unread_count + 1, updated_at = NOW()
     WHERE id = $2`,
    [content, conversationId]
  );

  return result.rows[0];
};

export const processIncomingMessage = async (message, businessId, phoneNumberId) => {
  const from = message.from;
  const messageId = message.id;

  let messageType = 'unknown';
  let content = '';

  if (message.type === 'text' && message.text) {
    messageType = 'text';
    content = message.text.body || '';
  } else if (message.type === 'button' && message.button) {
    messageType = 'button_reply';
    content = message.button.text || '';
  } else if (message.type === 'interactive' && message.interactive) {
    if (message.interactive.type === 'button_reply') {
      messageType = 'button_reply';
      content = message.interactive.button_reply?.title || '';
    } else if (message.interactive.type === 'list_reply') {
      messageType = 'list_reply';
      content = message.interactive.list_reply?.title || '';
    }
  } else if (message.type === 'image' && message.image) {
    messageType = 'image';
    content = message.image.caption || '[Image]';
  } else if (message.type === 'document' && message.document) {
    messageType = 'document';
    content = message.document.caption || '[Document]';
  } else if (message.type === 'location' && message.location) {
    messageType = 'location';
    content = `Location: ${message.location.latitude}, ${message.location.longitude}`;
  } else {
    content = `[${message.type || 'unknown'} message]`;
  }

  const customer = await findOrCreateCustomer(from, businessId);
  const conversation = await findOrCreateConversation(customer.id, from, businessId);

  const storedMessage = await storeIncomingMessage({
    businessId, conversationId: conversation.id, customerId: customer.id,
    phone: from, messageType, content, whatsappMessageId: messageId, rawPayload: message
  });

  return { customer, conversation, message: storedMessage };
};

export const processStatusUpdate = async (status) => {
  const whatsappMessageId = status.id;
  const messageStatus = status.status?.toUpperCase();

  if (!whatsappMessageId || !messageStatus) return null;

  const statusMap = { 'SENT': 'SENT', 'DELIVERED': 'DELIVERED', 'READ': 'READ', 'FAILED': 'FAILED' };
  const mappedStatus = statusMap[messageStatus];
  if (!mappedStatus) return null;

  return await updateMessageStatus(whatsappMessageId, mappedStatus, status);
};

export const processWebhookPayload = async (payload) => {
  const results = [];

  if (payload.object !== 'whatsapp_business_account') {
    return { processed: false, reason: 'Not a WhatsApp business account event' };
  }

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.value?.messaging_product !== 'whatsapp') continue;

      const phoneNumberId = change.value.metadata?.phone_number_id;

      for (const message of change.value.messages || []) {
        const eventId = message.id;

        if (await isEventProcessed(eventId)) {
          results.push({ type: 'message', id: eventId, status: 'duplicate' });
          continue;
        }

        const accountResult = await query(
          `SELECT business_id FROM whatsapp_accounts WHERE phone_number_id = $1 AND status = 'connected' LIMIT 1`,
          [phoneNumberId]
        );

        if (accountResult.rows.length === 0) {
          results.push({ type: 'message', id: eventId, status: 'no_account' });
          continue;
        }

        const businessId = accountResult.rows[0].business_id;

        try {
          const processed = await processIncomingMessage(message, businessId, phoneNumberId);
          await markEventProcessed(eventId, 'message', businessId);
          results.push({ type: 'message', id: eventId, status: 'processed', businessId });
        } catch (error) {
          console.error(`Failed to process message ${eventId}:`, error.message);
          results.push({ type: 'message', id: eventId, status: 'error', error: error.message });
        }
      }

      for (const status of change.value.statuses || []) {
        const eventId = `status_${status.id}_${status.status}`;

        if (await isEventProcessed(eventId)) {
          results.push({ type: 'status', id: status.id, status: 'duplicate' });
          continue;
        }

        try {
          await processStatusUpdate(status);
          await markEventProcessed(eventId, 'status', null);
          results.push({ type: 'status', id: status.id, status: 'processed' });
        } catch (error) {
          console.error(`Failed to process status ${status.id}:`, error.message);
          results.push({ type: 'status', id: status.id, status: 'error', error: error.message });
        }
      }
    }
  }

  return { processed: true, results };
};
