import { asyncHandler } from '../middleware/asyncHandler.js';
import * as notificationEngine from '../services/notificationEngine.service.js';

export const getTemplates = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const templates = await notificationEngine.getTemplates(businessId);
  res.status(200).json({ success: true, data: { templates } });
});

export const getTemplate = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const template = await notificationEngine.getTemplateById(req.params.id, businessId);
  if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
  res.status(200).json({ success: true, data: { template } });
});

export const createTemplate = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const template = await notificationEngine.createTemplate(req.body, businessId);
  res.status(201).json({ success: true, data: { template } });
});

export const updateTemplate = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const template = await notificationEngine.updateTemplate(req.params.id, req.body, businessId);
  res.status(200).json({ success: true, data: { template } });
});

export const deleteTemplate = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  await notificationEngine.deleteTemplate(req.params.id, businessId);
  res.status(200).json({ success: true });
});

export const previewTemplate = asyncHandler(async (req, res) => {
  const { body, context } = req.body;
  const rendered = notificationEngine.renderTemplate(body, context || {});
  res.status(200).json({ success: true, data: { rendered } });
});

export const getAutomationRules = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const rules = await notificationEngine.getAutomationRules(businessId);
  res.status(200).json({ success: true, data: { rules } });
});

export const createAutomationRule = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const userId = req.user.id;
  const rule = await notificationEngine.createAutomationRule(req.body, businessId, userId);
  res.status(201).json({ success: true, data: { rule } });
});

export const updateAutomationRule = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const rule = await notificationEngine.updateAutomationRule(req.params.id, req.body, businessId);
  res.status(200).json({ success: true, data: { rule } });
});

export const deleteAutomationRule = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  await notificationEngine.deleteAutomationRule(req.params.id, businessId);
  res.status(200).json({ success: true });
});

export const getNotificationLogs = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const logs = await notificationEngine.getNotificationLogs(req.query, businessId);
  res.status(200).json({ success: true, data: { logs } });
});

export const getCustomerPreferences = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const prefs = await notificationEngine.getCustomerPreferences(req.params.customerId, businessId);
  res.status(200).json({ success: true, data: { preferences: prefs } });
});

export const updateCustomerPreferences = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const prefs = await notificationEngine.updateCustomerPreferences(req.params.customerId, businessId, req.body);
  res.status(200).json({ success: true, data: { preferences: prefs } });
});
