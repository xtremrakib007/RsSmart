import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getOrders, getOrder, createOrder, updateStatus, deleteOrder, getStats
} from '../controllers/order.controller.js';

const router = Router();

router.get('/stats', authenticate, getStats);
router.get('/', authenticate, getOrders);
router.get('/:id', authenticate, getOrder);
router.post('/', authenticate, createOrder);
router.patch('/:id/status', authenticate, updateStatus);
router.delete('/:id', authenticate, deleteOrder);

export default router;
