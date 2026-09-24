import { asyncHandler } from '../middleware/asyncHandler.js';
import * as inventoryService from '../services/inventory.service.js';

export const getInventory = asyncHandler(async (req, res) => {
  const inventory = await inventoryService.getInventory(req.businessContext.businessId, req.query);
  res.status(200).json({ success: true, data: { inventory } });
});

export const getInventoryByProduct = asyncHandler(async (req, res) => {
  const inventory = await inventoryService.getInventoryByProduct(req.params.productId, req.businessContext.businessId);
  if (!inventory) return res.status(404).json({ success: false, message: 'Product not found' });
  res.status(200).json({ success: true, data: { inventory } });
});

export const getMovements = asyncHandler(async (req, res) => {
  const movements = await inventoryService.getInventoryMovements(
    req.params.productId, req.businessContext.businessId, req.query.limit || 50
  );
  res.status(200).json({ success: true, data: { movements } });
});

export const adjustStock = asyncHandler(async (req, res) => {
  const { quantityChange, reason, referenceType, referenceId } = req.body;
  if (quantityChange === undefined || quantityChange === 0) {
    return res.status(400).json({ success: false, message: 'quantityChange is required and cannot be zero' });
  }
  const result = await inventoryService.adjustStock({
    productId: req.params.productId,
    quantityChange,
    reason,
    referenceType,
    referenceId,
    userId: req.user.id,
    businessId: req.businessContext.businessId
  });
  res.status(200).json({ success: true, message: 'Stock adjusted', data: result });
});

export const getLowStock = asyncHandler(async (req, res) => {
  const products = await inventoryService.getLowStock(req.businessContext.businessId);
  res.status(200).json({ success: true, data: { products } });
});
