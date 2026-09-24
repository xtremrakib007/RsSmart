import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireBusinessContext } from '../middleware/businessContext.js';
import { requirePermission } from '../middleware/authorization.js';
import * as controller from '../controllers/subscription.controller.js';

const router = Router();

router.get('/plans', controller.getPlans);

router.use(authenticate, requireBusinessContext);

router.get('/business', controller.getBusinessSubscription);
router.post('/business', requirePermission('business:update'), controller.createSubscription);
router.delete('/business', requirePermission('business:update'), controller.cancelSubscription);
router.get('/feature-status', controller.getFeatureStatus);

export default router;
