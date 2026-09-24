import { asyncHandler } from '../middleware/asyncHandler.js';
import * as productService from '../services/product.service.js';

export const getProducts = asyncHandler(async (req, res) => {
  const products = await productService.getAllProducts(req.query, req.businessContext.businessId);
  res.status(200).json({ success: true, data: { products } });
});

export const getProduct = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(req.params.id, req.businessContext.businessId);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  res.status(200).json({ success: true, data: { product } });
});

export const createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.body, req.businessContext.businessId);
  res.status(201).json({ success: true, message: 'Product created', data: { product } });
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.body, req.businessContext.businessId);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  res.status(200).json({ success: true, message: 'Product updated', data: { product } });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const deleted = await productService.deleteProduct(req.params.id, req.businessContext.businessId);
  if (!deleted) return res.status(404).json({ success: false, message: 'Product not found' });
  res.status(200).json({ success: true, message: 'Product deleted' });
});

export const getLowStock = asyncHandler(async (req, res) => {
  const products = await productService.getLowStockProducts(req.businessContext.businessId);
  res.status(200).json({ success: true, data: { products } });
});
