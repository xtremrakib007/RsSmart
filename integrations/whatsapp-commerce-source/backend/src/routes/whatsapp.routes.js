import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireBusinessContext } from '../middleware/businessContext.js';
import {
  verifyWebhook, receiveWebhook, getHealth, getConversations, getMessages,
  sendMessage, getWebhookLogs, getTemplates, createTemplate, updateTemplate,
  deleteTemplate, sendTemplateMessage, getAccount, connectAccount,
  disconnectAccount, testConnection
} from '../controllers/whatsapp.controller.js';
import {
  getConversations as getInboxConversations, getConversation, getMessages as getInboxMessages,
  sendReply, takeover, returnToBot, assign, unassign, markRead,
  addNote, getNotes, getTags, addTag, removeTag, archive,
  getCustomerInfo, updateAvailability, getOnlineStaff
} from '../controllers/inbox.controller.js';

const router = Router();

// Public webhooks
router.get('/webhook', verifyWebhook);
router.post('/webhook', receiveWebhook);

// Protected WhatsApp routes
router.get('/health', authenticate, requireBusinessContext, getHealth);
router.get('/account', authenticate, requireBusinessContext, getAccount);
router.post('/account/connect', authenticate, requireBusinessContext, connectAccount);
router.post('/account/disconnect', authenticate, requireBusinessContext, disconnectAccount);
router.post('/account/test', authenticate, requireBusinessContext, testConnection);

router.get('/conversations', authenticate, requireBusinessContext, getConversations);
router.get('/conversations/:id/messages', authenticate, requireBusinessContext, getMessages);
router.post('/conversations/:id/messages', authenticate, requireBusinessContext, sendMessage);
router.get('/webhook-logs', authenticate, requireBusinessContext, getWebhookLogs);

router.get('/templates', authenticate, requireBusinessContext, getTemplates);
router.post('/templates', authenticate, requireBusinessContext, createTemplate);
router.put('/templates/:id', authenticate, requireBusinessContext, updateTemplate);
router.delete('/templates/:id', authenticate, requireBusinessContext, deleteTemplate);
router.post('/send-template', authenticate, requireBusinessContext, sendTemplateMessage);

// Inbox routes
router.get('/inbox/conversations', authenticate, requireBusinessContext, getInboxConversations);
router.get('/inbox/conversations/:id', authenticate, requireBusinessContext, getConversation);
router.get('/inbox/conversations/:id/messages', authenticate, requireBusinessContext, getInboxMessages);
router.post('/inbox/conversations/:id/reply', authenticate, requireBusinessContext, sendReply);
router.post('/inbox/conversations/:id/takeover', authenticate, requireBusinessContext, takeover);
router.post('/inbox/conversations/:id/return-to-bot', authenticate, requireBusinessContext, returnToBot);
router.post('/inbox/conversations/:id/assign', authenticate, requireBusinessContext, assign);
router.post('/inbox/conversations/:id/unassign', authenticate, requireBusinessContext, unassign);
router.post('/inbox/conversations/:id/read', authenticate, requireBusinessContext, markRead);
router.post('/inbox/conversations/:id/notes', authenticate, requireBusinessContext, addNote);
router.get('/inbox/conversations/:id/notes', authenticate, requireBusinessContext, getNotes);
router.get('/inbox/tags', authenticate, requireBusinessContext, getTags);
router.post('/inbox/conversations/:id/tags', authenticate, requireBusinessContext, addTag);
router.delete('/inbox/conversations/:id/tags', authenticate, requireBusinessContext, removeTag);
router.post('/inbox/conversations/:id/archive', authenticate, requireBusinessContext, archive);
router.get('/inbox/conversations/:id/customer', authenticate, requireBusinessContext, getCustomerInfo);
router.post('/inbox/staff/availability', authenticate, requireBusinessContext, updateAvailability);
router.get('/inbox/staff/online', authenticate, requireBusinessContext, getOnlineStaff);

export default router;
