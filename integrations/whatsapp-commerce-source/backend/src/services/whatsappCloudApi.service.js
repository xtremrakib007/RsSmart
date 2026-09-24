import { query } from '../database/connection.js';
import { withRetry, isRetryableError } from '../utils/retry.js';
import { normalizePhone } from '../utils/phone.js';

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v20.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

export const getWhatsAppAccount = async (businessId) => {
  const result = await query(
    `SELECT * FROM whatsapp_accounts WHERE business_id = $1 AND status = 'connected' LIMIT 1`,
    [businessId]
  );
  return result.rows[0] || null;
};

export const getAccountByPhoneNumberId = async (phoneNumberId) => {
  const result = await query(
    `SELECT wa.*, b.id as business_id FROM whatsapp_accounts wa
     JOIN businesses b ON wa.business_id = b.id
     WHERE wa.phone_number_id = $1 AND wa.status = 'connected' LIMIT 1`,
    [phoneNumberId]
  );
  return result.rows[0] || null;
};

const storeOutgoingMessage = async ({
  businessId, conversationId, customerId, phone, messageType, content,
  mediaUrl = null, whatsappMessageId = null, status = 'QUEUED',
  errorMessage = null, rawPayload = null
}) => {
  const result = await query(
    `INSERT INTO whatsapp_messages
      (business_id, conversation_id, customer_id, phone, direction, message_type, content, media_url, whatsapp_message_id, status, error_message, raw_payload, sent_at)
     VALUES ($1, $2, $3, $4, 'outbound', $5, $6, $7, $8, $9, $10, $11, NOW())
     RETURNING *`,
    [businessId, conversationId, customerId, phone, messageType, content, mediaUrl,
     whatsappMessageId, status, errorMessage, rawPayload ? JSON.stringify(rawPayload) : null]
  );
  return result.rows[0];
};

export const updateMessageStatus = async (whatsappMessageId, status, rawPayload = null) => {
  const timestamp = new Date();
  let updateFields = 'status = $1, updated_at = $2';
  const params = [status, timestamp];

  if (status === 'SENT') {
    updateFields += ', sent_at = $3';
    params.push(timestamp);
  } else if (status === 'DELIVERED') {
    updateFields += ', delivered_at = $3';
    params.push(timestamp);
  } else if (status === 'READ') {
    updateFields += ', read_at = $3';
    params.push(timestamp);
  }

  params.push(whatsappMessageId);

  const result = await query(
    `UPDATE whatsapp_messages SET ${updateFields} WHERE whatsapp_message_id = $${params.length} RETURNING *`,
    params
  );

  if (result.rows[0]) {
    await query(
      `INSERT INTO whatsapp_message_status_history (message_id, status, timestamp, raw_payload) VALUES ($1, $2, $3, $4)`,
      [result.rows[0].id, status, timestamp, rawPayload ? JSON.stringify(rawPayload) : null]
    );
  }

  return result.rows[0] || null;
};

const callWhatsAppApi = async (phoneNumberId, accessToken, endpoint, payload) => {
  const url = `${BASE_URL}/${phoneNumberId}/${endpoint}`;

  return withRetry(async () => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error?.message || `WhatsApp API error: ${response.status}`);
      error.statusCode = response.status;
      error.response = data;
      throw error;
    }

    return data;
  }, { shouldRetry: isRetryableError });
};

export const sendText = async (businessId, phone, text, options = {}) => {
  const account = await getWhatsAppAccount(businessId);
  if (!account) {
    throw new Error('No connected WhatsApp account found for this business');
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    throw new Error('Invalid phone number');
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizedPhone,
    type: 'text',
    text: { body: text, preview_url: options.previewUrl || false }
  };

  const result = await callWhatsAppApi(account.phone_number_id, account.access_token_encrypted, 'messages', payload);

  await storeOutgoingMessage({
    businessId, conversationId: options.conversationId || null,
    customerId: options.customerId || null, phone: normalizedPhone,
    messageType: 'text', content: text,
    whatsappMessageId: result.messages?.[0]?.id || null, status: 'SENT', rawPayload: result
  });

  return { success: true, messageId: result.messages?.[0]?.id, status: 'SENT' };
};

export const sendButtonMessage = async (businessId, phone, bodyText, buttons, options = {}) => {
  const account = await getWhatsAppAccount(businessId);
  if (!account) throw new Error('No connected WhatsApp account found for this business');

  const normalizedPhone = normalizePhone(phone);
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizedPhone,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map((btn, idx) => ({
          type: 'reply',
          reply: { id: btn.id || `btn_${idx}`, title: btn.title }
        }))
      }
    }
  };

  if (options.header) {
    payload.interactive.header = { type: 'text', text: options.header };
  }
  if (options.footer) {
    payload.interactive.footer = { text: options.footer };
  }

  const result = await callWhatsAppApi(account.phone_number_id, account.access_token_encrypted, 'messages', payload);

  await storeOutgoingMessage({
    businessId, conversationId: options.conversationId || null,
    customerId: options.customerId || null, phone: normalizedPhone,
    messageType: 'button', content: JSON.stringify({ body: bodyText, buttons }),
    whatsappMessageId: result.messages?.[0]?.id || null, status: 'SENT', rawPayload: result
  });

  return { success: true, messageId: result.messages?.[0]?.id, status: 'SENT' };
};

export const sendListMessage = async (businessId, phone, bodyText, sections, options = {}) => {
  const account = await getWhatsAppAccount(businessId);
  if (!account) throw new Error('No connected WhatsApp account found for this business');

  const normalizedPhone = normalizePhone(phone);
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizedPhone,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText },
      action: {
        button: options.buttonText || 'Options',
        sections: sections.map((section, sIdx) => ({
          title: section.title || `Section ${sIdx + 1}`,
          rows: section.rows.map((row, rIdx) => ({
            id: row.id || `row_${sIdx}_${rIdx}`,
            title: row.title,
            description: row.description || ''
          }))
        }))
      }
    }
  };

  if (options.header) {
    payload.interactive.header = { type: 'text', text: options.header };
  }
  if (options.footer) {
    payload.interactive.footer = { text: options.footer };
  }

  const result = await callWhatsAppApi(account.phone_number_id, account.access_token_encrypted, 'messages', payload);

  await storeOutgoingMessage({
    businessId, conversationId: options.conversationId || null,
    customerId: options.customerId || null, phone: normalizedPhone,
    messageType: 'list', content: JSON.stringify({ body: bodyText, sections }),
    whatsappMessageId: result.messages?.[0]?.id || null, status: 'SENT', rawPayload: result
  });

  return { success: true, messageId: result.messages?.[0]?.id, status: 'SENT' };
};

export const sendImage = async (businessId, phone, imageUrl, caption = '', options = {}) => {
  const account = await getWhatsAppAccount(businessId);
  if (!account) throw new Error('No connected WhatsApp account found for this business');

  const normalizedPhone = normalizePhone(phone);
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizedPhone,
    type: 'image',
    image: { link: imageUrl, caption: caption }
  };

  const result = await callWhatsAppApi(account.phone_number_id, account.access_token_encrypted, 'messages', payload);

  await storeOutgoingMessage({
    businessId, conversationId: options.conversationId || null,
    customerId: options.customerId || null, phone: normalizedPhone,
    messageType: 'image', content: caption, mediaUrl: imageUrl,
    whatsappMessageId: result.messages?.[0]?.id || null, status: 'SENT', rawPayload: result
  });

  return { success: true, messageId: result.messages?.[0]?.id, status: 'SENT' };
};

export const sendDocument = async (businessId, phone, documentUrl, filename, caption = '', options = {}) => {
  const account = await getWhatsAppAccount(businessId);
  if (!account) throw new Error('No connected WhatsApp account found for this business');

  const normalizedPhone = normalizePhone(phone);
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizedPhone,
    type: 'document',
    document: { link: documentUrl, filename: filename, caption: caption }
  };

  const result = await callWhatsAppApi(account.phone_number_id, account.access_token_encrypted, 'messages', payload);

  await storeOutgoingMessage({
    businessId, conversationId: options.conversationId || null,
    customerId: options.customerId || null, phone: normalizedPhone,
    messageType: 'document', content: caption, mediaUrl: documentUrl,
    whatsappMessageId: result.messages?.[0]?.id || null, status: 'SENT', rawPayload: result
  });

  return { success: true, messageId: result.messages?.[0]?.id, status: 'SENT' };
};

export const sendTemplateMessage = async (businessId, phone, templateName, languageCode = 'en', components = [], options = {}) => {
  const account = await getWhatsAppAccount(businessId);
  if (!account) throw new Error('No connected WhatsApp account found for this business');

  const normalizedPhone = normalizePhone(phone);
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizedPhone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode }
    }
  };

  if (components && components.length > 0) {
    payload.template.components = components;
  }

  const result = await callWhatsAppApi(account.phone_number_id, account.access_token_encrypted, 'messages', payload);

  await storeOutgoingMessage({
    businessId, conversationId: options.conversationId || null,
    customerId: options.customerId || null, phone: normalizedPhone,
    messageType: 'template', content: templateName,
    whatsappMessageId: result.messages?.[0]?.id || null, status: 'SENT', rawPayload: result
  });

  return { success: true, messageId: result.messages?.[0]?.id, status: 'SENT' };
};

export const testConnection = async (phoneNumberId, accessToken) => {
  const url = `${BASE_URL}/${phoneNumberId}?access_token=${accessToken}`;
  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error('Failed to connect to WhatsApp Cloud API');
    error.statusCode = response.status;
    throw error;
  }
  return await response.json();
};
