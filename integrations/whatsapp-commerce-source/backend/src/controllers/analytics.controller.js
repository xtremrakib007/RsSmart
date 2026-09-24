import { asyncHandler } from '../middleware/asyncHandler.js';
import * as analyticsService from '../services/analytics.service.js';

export const getSalesOverview = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const data = await analyticsService.getSalesOverview(days, req.businessContext.businessId);
  res.status(200).json({ success: true, data: { sales: data } });
});

export const getTopProducts = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  const data = await analyticsService.getTopProducts(limit, req.businessContext.businessId);
  res.status(200).json({ success: true, data: { products: data } });
});

export const getOrderStatusBreakdown = asyncHandler(async (req, res) => {
  const data = await analyticsService.getOrderStatusBreakdown(req.businessContext.businessId);
  res.status(200).json({ success: true, data: { breakdown: data } });
});

export const getCustomerGrowth = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const data = await analyticsService.getCustomerGrowth(days, req.businessContext.businessId);
  res.status(200).json({ success: true, data: { growth: data } });
});

export const getRevenueByCategory = asyncHandler(async (req, res) => {
  const data = await analyticsService.getRevenueByCategory(req.businessContext.businessId);
  res.status(200).json({ success: true, data: { categories: data } });
});

export const getRecentActivity = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const data = await analyticsService.getRecentActivity(limit, req.businessContext.businessId);
  res.status(200).json({ success: true, data: { activity: data } });
});

export const getDashboardSummary = asyncHandler(async (req, res) => {
  const data = await analyticsService.getDashboardSummary(req.businessContext.businessId);
  res.status(200).json({ success: true, data: { summary: data } });
});
