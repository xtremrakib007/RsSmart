import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireBusinessContext } from '../middleware/businessContext.js';
import {
  getTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate,
  previewTemplate, getAutomationRules, createAutomationRule, updateAutomationRule,
  deleteAutomationRule, getNotificationLogs, getCustomerPreferences, updateCustomerPreferences
} from '../controllers/notification.controller.js';

const router = Router();

router.get('/templates', authenticate, requireBusinessContext, getTemplates);
router.post('/templates', authenticate, requireBusinessContext, createTemplate);
router.get('/templates/:id', authenticate, requireBusinessContext, getTemplate);
router.put('/templates/:id', authenticate, requireBusinessContext, updateTemplate);
router.delete('/templates/:id', authenticate, requireBusinessContext, deleteTemplate);
router.post('/templates/preview', authenticate, requireBusinessContext, previewTemplate);

router.get('/automation', authenticate, requireBusinessContext, getAutomationRules);
router.post('/automation', authenticate, requireBusinessContext, createAutomationRule);
router.put('/automation/:id', authenticate, requireBusinessContext, updateAutomationRule);
router.delete('/automation/:id', authenticate, requireBusinessContext, deleteAutomationRule);

router.get('/logs', authenticate, requireBusinessContext, getNotificationLogs);

router.get('/preferences/:customerId', authenticate, requireBusinessContext, getCustomerPreferences);
router.put('/preferences/:customerId', authenticate, requireBusinessContext, updateCustomerPreferences);

export default router;
