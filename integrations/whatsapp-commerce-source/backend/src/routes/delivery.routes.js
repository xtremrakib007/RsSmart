import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireBusinessContext } from '../middleware/businessContext.js';
import {
  createDelivery, getDelivery, getDeliveryByOrder, getDeliveries,
  updateStatus, markPickupComplete, getStatusHistory,
  getSettings, updateSettings, getMethods
} from '../controllers/delivery.controller.js';

const router = Router();

router.get('/settings', authenticate, requireBusinessContext, getSettings);
router.put('/settings', authenticate, requireBusinessContext, updateSettings);
router.get('/methods', authenticate, requireBusinessContext, getMethods);

router.post('/', authenticate, requireBusinessContext, createDelivery);
router.get('/', authenticate, requireBusinessContext, getDeliveries);
router.get('/order/:orderId', authenticate, requireBusinessContext, getDeliveryByOrder);
router.get('/:id', authenticate, requireBusinessContext, getDelivery);
router.put('/:id/status', authenticate, requireBusinessContext, updateStatus);
router.post('/:id/pickup', authenticate, requireBusinessContext, markPickupComplete);
router.get('/:id/history', authenticate, requireBusinessContext, getStatusHistory);

export default router;
