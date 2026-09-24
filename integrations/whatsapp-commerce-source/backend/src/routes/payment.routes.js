import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireBusinessContext } from '../middleware/businessContext.js';
import {
  createPayment, getPayment, getPayments, getPaymentsByOrder,
  handleWebhook, refundPayment, getPaymentStats
} from '../controllers/payment.controller.js';

const router = Router();

// Public webhook (provider-specific verification inside controller)
router.post('/webhook/:provider', handleWebhook);

// Protected routes
router.post('/create', authenticate, requireBusinessContext, createPayment);
router.get('/stats', authenticate, requireBusinessContext, getPaymentStats);
router.get('/order/:orderId', authenticate, requireBusinessContext, getPaymentsByOrder);
router.get('/:id', authenticate, requireBusinessContext, getPayment);
router.get('/', authenticate, requireBusinessContext, getPayments);
router.post('/:id/refund', authenticate, requireBusinessContext, refundPayment);

export default router;
