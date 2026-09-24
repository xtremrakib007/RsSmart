import { asyncHandler } from '../middleware/asyncHandler.js';
import * as paymentService from '../services/payment.service.js';

export const createPayment = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const { orderId, provider, paymentMethod, metadata } = req.body;

  const payment = await paymentService.createPayment({
    businessId, orderId, customerId: req.body.customerId,
    provider: provider || 'test', paymentMethod, metadata
  });

  res.status(201).json({ success: true, data: { payment } });
});

export const getPayment = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const payment = await paymentService.getPaymentById(req.params.id, businessId);
  if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
  res.status(200).json({ success: true, data: { payment } });
});

export const getPayments = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const payments = await paymentService.getAllPayments(req.query, businessId);
  const stats = await paymentService.getPaymentStats(businessId);
  res.status(200).json({ success: true, data: { payments, stats } });
});

export const getPaymentsByOrder = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const payments = await paymentService.getPaymentsByOrder(req.params.orderId, businessId);
  res.status(200).json({ success: true, data: { payments } });
});

export const handleWebhook = asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const signature = req.headers['x-webhook-signature'];

  // Respond immediately
  res.status(200).json({ received: true });

  try {
    const result = await paymentService.handleWebhook(provider, req.body, signature);
    console.log('[PaymentWebhook]', result);
  } catch (error) {
    console.error('[PaymentWebhook] Error:', error.message);
  }
});

export const refundPayment = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const userId = req.user.id;
  const { amount, reason } = req.body;

  const result = await paymentService.refundPayment(req.params.id, amount, reason, userId, businessId);
  res.status(200).json({ success: true, data: result });
});

export const getPaymentStats = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const stats = await paymentService.getPaymentStats(businessId);
  res.status(200).json({ success: true, data: stats });
});
