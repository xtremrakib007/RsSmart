import { asyncHandler } from '../middleware/asyncHandler.js';
import * as aiService from '../services/ai.service.js';

export const getSettings = asyncHandler(async (req, res) => {
  const data = await aiService.getAISettings(req.businessContext.businessId);
  res.status(200).json({ success: true, data: { settings: data } });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const data = await aiService.updateAISettings(req.businessContext.businessId, req.body);
  res.status(200).json({ success: true, data: { settings: data } });
});

export const getTools = asyncHandler(async (req, res) => {
  const data = aiService.getAvailableTools();
  res.status(200).json({ success: true, data: { tools: data } });
});

export const executeTool = asyncHandler(async (req, res) => {
  const { toolName, params } = req.body;
  const context = {
    businessId: req.businessContext.businessId,
    customerId: req.body.customerId || null
  };
  const result = await aiService.executeTool(toolName, params || {}, context);
  res.status(200).json({ success: true, data: result });
});

export const getUsage = asyncHandler(async (req, res) => {
  const monthlyCost = await aiService.getMonthlyAICost(req.businessContext.businessId);
  const settings = await aiService.getAISettings(req.businessContext.businessId);
  res.status(200).json({
    success: true,
    data: { monthlyCost, limit: settings.monthly_usage_limit, remaining: Math.max(0, settings.monthly_usage_limit - monthlyCost) }
  });
});

export const checkHandoff = asyncHandler(async (req, res) => {
  const { message } = req.body;
  const result = await aiService.shouldHandoff(req.businessContext.businessId, message);
  res.status(200).json({ success: true, data: result });
});
