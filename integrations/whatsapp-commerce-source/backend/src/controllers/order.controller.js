import { asyncHandler } from '../middleware/asyncHandler.js';
import * as orderService from '../services/order.service.js';

export const getOrders = asyncHandler(async (req, res) => {
  const orders = await orderService.getAllOrders(req.query, req.businessContext.businessId);
  res.status(200).json({ success: true, data: { orders } });
});

export const getOrder = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.params.id, req.businessContext.businessId);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  res.status(200).json({ success: true, data: { order } });
});

export const createOrder = asyncHandler(async (req, res) => {
  const order = await orderService.createOrder(req.body, req.user?.id, req.businessContext.businessId);
  res.status(201).json({ success: true, message: 'Order created', data: { order } });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const { status, notes } = req.body;
  const order = await orderService.updateOrderStatus(req.params.id, status, req.user?.id, notes, req.businessContext.businessId);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  res.status(200).json({ success: true, message: 'Status updated', data: { order } });
});

export const deleteOrder = asyncHandler(async (req, res) => {
  const deleted = await orderService.deleteOrder(req.params.id, req.businessContext.businessId);
  if (!deleted) return res.status(404).json({ success: false, message: 'Order not found' });
  res.status(200).json({ success: true, message: 'Order deleted' });
});

export const getStats = asyncHandler(async (req, res) => {
  const stats = await orderService.getOrderStats(req.businessContext.businessId);
  res.status(200).json({ success: true, data: { stats } });
});
