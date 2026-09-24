import { asyncHandler } from '../middleware/asyncHandler.js';
import { query } from '../database/connection.js';
import * as whatsappCloudApi from '../services/whatsappCloudApi.service.js';
import * as whatsappWebhook from '../services/whatsappWebhook.service.js';
import * as templateService from '../services/template.service.js';

export const verifyWebhook = asyncHandler(async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WEBHOOK] Verification successful');
    return res.status(200).send(challenge);
  }

  console.warn('[WEBHOOK] Verification failed', { mode, token });
  return res.status(403).json({ success: false, message: 'Verification failed' });
});

export const receiveWebhook = asyncHandler(async (req, res) => {
  res.status(200).send('EVENT_RECEIVED');

  const payload = req.body;
  console.log('[WEBHOOK] Received payload', JSON.stringify(payload).substring(0, 500));

  try {
    const result = await whatsappWebhook.processWebhookPayload(payload);
    console.log('[WEBHOOK] Processed', result);
  } catch (error) {
    console.error('[WEBHOOK] Processing error:', error.message);
  }
});

export const getHealth = asyncHandler(async (req, res) => {
  const businessId = req.businessContext?.businessId;
  if (!businessId) {
    return res.status(400).json({ success: false, message: 'Business context required' });
  }

  const accountResult = await query(
    `SELECT status, phone_number_id, display_phone_number, webhook_configured, updated_at
     FROM whatsapp_accounts WHERE business_id = $1 LIMIT 1`,
    [businessId]
  );

  const account = accountResult.rows[0];

  res.status(200).json({
    success: true,
    data: {
      connected: account?.status === 'connected',
      configured: !!account,
      phoneNumber: account?.display_phone_number || null,
      phoneNumberId: account?.phone_number_id || null,
      webhookConfigured: account?.webhook_configured || false,
      lastUpdated: account?.updated_at || null
    }
  });
});

export const getConversations = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const result = await query(
    `SELECT wc.*, c.full_name as customer_name
     FROM whatsapp_conversations wc
     LEFT JOIN customers c ON wc.customer_id = c.id
     WHERE wc.business_id = $1
     ORDER BY wc.last_message_at DESC NULLS LAST`,
    [businessId]
  );
  res.status(200).json({ success: true, data: { conversations: result.rows } });
});

export const getMessages = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const conversationId = req.params.id;

  const convResult = await query(
    `SELECT 1 FROM whatsapp_conversations WHERE id = $1 AND business_id = $2`,
    [conversationId, businessId]
  );
  if (convResult.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Conversation not found' });
  }

  const result = await query(
    `SELECT * FROM whatsapp_messages
     WHERE conversation_id = $1 AND business_id = $2
     ORDER BY created_at ASC`,
    [conversationId, businessId]
  );
  res.status(200).json({ success: true, data: { messages: result.rows } });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const conversationId = req.params.id;
  const { content, messageType = 'text' } = req.body;

  const convResult = await query(
    `SELECT * FROM whatsapp_conversations WHERE id = $1 AND business_id = $2`,
    [conversationId, businessId]
  );
  if (convResult.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Conversation not found' });
  }
  const conversation = convResult.rows[0];

  const result = await whatsappCloudApi.sendText(
    businessId, conversation.phone, content,
    { conversationId, customerId: conversation.customer_id }
  );

  res.status(201).json({ success: true, data: { message: result } });
});

export const getWebhookLogs = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);

  const result = await query(
    `SELECT * FROM webhook_logs WHERE business_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [businessId, limit]
  );
  res.status(200).json({ success: true, data: { logs: result.rows } });
});

export const getTemplates = asyncHandler(async (req, res) => {
  const templates = await templateService.getAllTemplates(req.businessContext.businessId);
  res.status(200).json({ success: true, data: { templates } });
});

export const createTemplate = asyncHandler(async (req, res) => {
  const template = await templateService.createTemplate(req.body, req.businessContext.businessId);
  res.status(201).json({ success: true, data: { template } });
});

export const updateTemplate = asyncHandler(async (req, res) => {
  const template = await templateService.updateTemplate(req.params.id, req.body, req.businessContext.businessId);
  if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
  res.status(200).json({ success: true, data: { template } });
});

export const deleteTemplate = asyncHandler(async (req, res) => {
  const deleted = await templateService.deleteTemplate(req.params.id, req.businessContext.businessId);
  if (!deleted) return res.status(404).json({ success: false, message: 'Template not found' });
  res.status(200).json({ success: true, message: 'Template deleted' });
});

export const sendTemplateMessage = asyncHandler(async (req, res) => {
  const { phone, templateName, languageCode, components } = req.body;
  const businessId = req.businessContext.businessId;

  const result = await whatsappCloudApi.sendTemplateMessage(
    businessId, phone, templateName, languageCode || 'en', components || []
  );

  res.status(200).json({ success: true, data: result });
});

export const getAccount = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const result = await query(
    `SELECT id, business_id, phone_number_id, business_account_id, display_phone_number, status, webhook_configured, created_at, updated_at
     FROM whatsapp_accounts WHERE business_id = $1 LIMIT 1`,
    [businessId]
  );
  res.status(200).json({ success: true, data: { account: result.rows[0] || null } });
});

export const connectAccount = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const { phoneNumberId, businessAccountId, accessToken, displayPhoneNumber } = req.body;

  if (!phoneNumberId || !accessToken) {
    return res.status(400).json({ success: false, message: 'phoneNumberId and accessToken are required' });
  }

  try {
    await whatsappCloudApi.testConnection(phoneNumberId, accessToken);
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Invalid WhatsApp credentials', error: error.message });
  }

  const existing = await query(
    `SELECT id FROM whatsapp_accounts WHERE business_id = $1`, [businessId]
  );

  if (existing.rows.length > 0) {
    await query(
      `UPDATE whatsapp_accounts
       SET phone_number_id = $1, business_account_id = $2, access_token_encrypted = $3,
           display_phone_number = $4, status = 'connected', updated_at = NOW()
       WHERE business_id = $5`,
      [phoneNumberId, businessAccountId || null, accessToken, displayPhoneNumber || null, businessId]
    );
  } else {
    await query(
      `INSERT INTO whatsapp_accounts (business_id, phone_number_id, business_account_id, access_token_encrypted, display_phone_number, status)
       VALUES ($1, $2, $3, $4, $5, 'connected')`,
      [businessId, phoneNumberId, businessAccountId || null, accessToken, displayPhoneNumber || null]
    );
  }

  res.status(200).json({ success: true, message: 'WhatsApp account connected' });
});

export const disconnectAccount = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  await query(
    `UPDATE whatsapp_accounts SET status = 'disconnected', updated_at = NOW() WHERE business_id = $1`,
    [businessId]
  );
  res.status(200).json({ success: true, message: 'WhatsApp account disconnected' });
});

export const testConnection = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const account = await whatsappCloudApi.getWhatsAppAccount(businessId);

  if (!account) {
    return res.status(400).json({ success: false, message: 'No WhatsApp account configured' });
  }

  try {
    await whatsappCloudApi.testConnection(account.phone_number_id, account.access_token_encrypted);
    res.status(200).json({ success: true, message: 'Connection successful' });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Connection failed', error: error.message });
  }
});
