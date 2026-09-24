import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireBusinessContext } from '../middleware/businessContext.js';
import { requirePermission } from '../middleware/authorization.js';
import * as controller from '../controllers/campaign.controller.js';

const router = Router();

router.use(authenticate, requireBusinessContext, requirePermission('campaign:read'));

router.get('/', controller.getCampaigns);
router.post('/', requirePermission('campaign:create'), controller.createCampaign);
router.get('/:id', controller.getCampaign);
router.put('/:id', requirePermission('campaign:update'), controller.updateCampaign);
router.delete('/:id', requirePermission('campaign:delete'), controller.deleteCampaign);
router.post('/:id/queue', requirePermission('campaign:create'), controller.queueCampaign);
router.get('/:id/stats', controller.getCampaignStats);
router.get('/:id/audience', controller.getCampaignAudience);

export default router;
