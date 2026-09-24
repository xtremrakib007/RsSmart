import { asyncHandler } from '../middleware/asyncHandler.js';
import * as categoryService from '../services/category.service.js';

export const getCategories = asyncHandler(async (req, res) => {
  const categories = await categoryService.getAllCategories(req.businessContext.businessId);
  res.status(200).json({ success: true, data: { categories } });
});

export const getCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryById(req.params.id, req.businessContext.businessId);
  if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
  res.status(200).json({ success: true, data: { category } });
});

export const createCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.body, req.businessContext.businessId);
  res.status(201).json({ success: true, message: 'Category created', data: { category } });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(req.params.id, req.body, req.businessContext.businessId);
  if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
  res.status(200).json({ success: true, message: 'Category updated', data: { category } });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const deleted = await categoryService.deleteCategory(req.params.id, req.businessContext.businessId);
  if (!deleted) return res.status(404).json({ success: false, message: 'Category not found' });
  res.status(200).json({ success: true, message: 'Category deleted' });
});
