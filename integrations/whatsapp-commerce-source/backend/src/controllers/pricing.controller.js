import { asyncHandler } from '../middleware/asyncHandler.js';
import * as pricingService from '../services/pricing.service.js';

export const getPrice = asyncHandler(async (req, res) => {
  const { productId, customerId, quantity } = req.query;
  if (!productId) {
    return res.status(400).json({ success: false, message: 'productId is required' });
  }
  const price = await pricingService.getProductPrice({
    businessId: req.businessContext.businessId,
    customerId,
    productId,
    quantity: parseInt(quantity) || 1
  });
  res.status(200).json({ success: true, data: price });
});

export const getPriceLevels = asyncHandler(async (req, res) => {
  const levels = await pricingService.getPriceLevels(req.businessContext.businessId);
  res.status(200).json({ success: true, data: { levels } });
});

export const createPriceLevel = asyncHandler(async (req, res) => {
  const level = await pricingService.createPriceLevel(req.body, req.businessContext.businessId);
  res.status(201).json({ success: true, message: 'Price level created', data: { level } });
});

export const updatePriceLevel = asyncHandler(async (req, res) => {
  const level = await pricingService.updatePriceLevel(req.params.id, req.body, req.businessContext.businessId);
  if (!level) return res.status(404).json({ success: false, message: 'Price level not found' });
  res.status(200).json({ success: true, message: 'Price level updated', data: { level } });
});

export const deletePriceLevel = asyncHandler(async (req, res) => {
  const deleted = await pricingService.deletePriceLevel(req.params.id, req.businessContext.businessId);
  if (!deleted) return res.status(404).json({ success: false, message: 'Price level not found' });
  res.status(200).json({ success: true, message: 'Price level deleted' });
});

export const getProductPrices = asyncHandler(async (req, res) => {
  const prices = await pricingService.getProductPrices(req.params.productId, req.businessContext.businessId);
  res.status(200).json({ success: true, data: { prices } });
});

export const setProductPrice = asyncHandler(async (req, res) => {
  const price = await pricingService.setProductPrice(
    { ...req.body, productId: req.params.productId },
    req.businessContext.businessId
  );
  res.status(200).json({ success: true, message: 'Product price set', data: { price } });
});

export const deleteProductPrice = asyncHandler(async (req, res) => {
  const deleted = await pricingService.deleteProductPrice(req.params.priceId, req.businessContext.businessId);
  if (!deleted) return res.status(404).json({ success: false, message: 'Product price not found' });
  res.status(200).json({ success: true, message: 'Product price deleted' });
});

export const getQuantityRules = asyncHandler(async (req, res) => {
  const rules = await pricingService.getQuantityRules(req.params.productId, req.businessContext.businessId);
  res.status(200).json({ success: true, data: { rules } });
});

export const createQuantityRule = asyncHandler(async (req, res) => {
  const rule = await pricingService.createQuantityRule(
    { ...req.body, productId: req.params.productId },
    req.businessContext.businessId
  );
  res.status(201).json({ success: true, message: 'Quantity rule created', data: { rule } });
});

export const updateQuantityRule = asyncHandler(async (req, res) => {
  const rule = await pricingService.updateQuantityRule(req.params.ruleId, req.body, req.businessContext.businessId);
  if (!rule) return res.status(404).json({ success: false, message: 'Quantity rule not found' });
  res.status(200).json({ success: true, message: 'Quantity rule updated', data: { rule } });
});

export const deleteQuantityRule = asyncHandler(async (req, res) => {
  const deleted = await pricingService.deleteQuantityRule(req.params.ruleId, req.businessContext.businessId);
  if (!deleted) return res.status(404).json({ success: false, message: 'Quantity rule not found' });
  res.status(200).json({ success: true, message: 'Quantity rule deleted' });
});

export const getCustomerPriceLevel = asyncHandler(async (req, res) => {
  const cpl = await pricingService.getCustomerPriceLevel(req.params.customerId, req.businessContext.businessId);
  res.status(200).json({ success: true, data: { priceLevel: cpl } });
});

export const setCustomerPriceLevel = asyncHandler(async (req, res) => {
  const { priceLevelId } = req.body;
  if (!priceLevelId) {
    return res.status(400).json({ success: false, message: 'priceLevelId is required' });
  }
  const cpl = await pricingService.setCustomerPriceLevel(
    req.params.customerId, priceLevelId, req.businessContext.businessId
  );
  res.status(200).json({ success: true, message: 'Customer price level set', data: { priceLevel: cpl } });
});
