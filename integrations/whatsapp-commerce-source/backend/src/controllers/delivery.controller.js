import { asyncHandler } from '../middleware/asyncHandler.js';
import * as deliveryService from '../services/delivery.service.js';

export const createDelivery = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const delivery = await deliveryService.createDelivery({ ...req.body, businessId });
  res.status(201).json({ success: true, data: { delivery } });
});

export const getDelivery = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const delivery = await deliveryService.getDeliveryById(req.params.id, businessId);
  if (!delivery) return res.status(404).json({ success: false, message: 'Delivery not found' });
  res.status(200).json({ success: true, data: { delivery } });
});

export const getDeliveryByOrder = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const delivery = await deliveryService.getDeliveryByOrder(req.params.orderId, businessId);
  if (!delivery) return res.status(404).json({ success: false, message: 'Delivery not found' });
  res.status(200).json({ success: true, data: { delivery } });
});

export const getDeliveries = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const deliveries = await deliveryService.getAllDeliveries(req.query, businessId);
  res.status(200).json({ success: true, data: { deliveries } });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const userId = req.user.id;
  const { status, reason, trackingNumber, courierProvider, driverName, driverPhone, estimatedDeliveryDate } = req.body;

  const delivery = await deliveryService.updateDeliveryStatus(req.params.id, status, {
    changedBy: userId, source: 'ADMIN', reason, trackingNumber, courierProvider,
    driverName, driverPhone, estimatedDeliveryDate
  });

  res.status(200).json({ success: true, data: { delivery } });
});

export const markPickupComplete = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const userId = req.user.id;
  const { pickedUpBy, pickupReference } = req.body;

  await deliveryService.markPickupComplete(req.params.id, {
    pickedUpBy, pickupReference, changedBy: userId, businessId
  });

  res.status(200).json({ success: true, message: 'Pickup marked complete' });
});

export const getStatusHistory = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const history = await deliveryService.getDeliveryStatusHistory(req.params.id, businessId);
  res.status(200).json({ success: true, data: { history } });
});

export const getSettings = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const settings = await deliveryService.getFulfillmentSettings(businessId);
  res.status(200).json({ success: true, data: { settings } });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const settings = await deliveryService.updateFulfillmentSettings(businessId, req.body);
  res.status(200).json({ success: true, data: { settings } });
});

export const getMethods = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const methods = await deliveryService.getAvailableFulfillmentMethods(businessId);
  res.status(200).json({ success: true, data: { methods } });
});
