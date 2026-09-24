import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireBusinessContext } from '../middleware/businessContext.js';
import { requirePermission } from '../middleware/authorization.js';
import * as controller from '../controllers/ai.controller.js';

const router = Router();

router.use(authenticate, requireBusinessContext);

router.get('/settings', requirePermission('settings:read'), controller.getSettings);
router.put('/settings', requirePermission('settings:update'), controller.updateSettings);
router.get('/tools', controller.getTools);
router.post('/execute-tool', controller.executeTool);
router.get('/usage', controller.getUsage);
router.post('/check-handoff', controller.checkHandoff);

export default router;
