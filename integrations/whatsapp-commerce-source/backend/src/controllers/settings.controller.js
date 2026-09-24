import { asyncHandler } from '../middleware/asyncHandler.js';
import * as settingsService from '../services/settings.service.js';

export const getSettings = asyncHandler(async (req, res) => {
  const { category } = req.query;
  const settings = await settingsService.getAllSettings(req.businessContext.businessId, category);
  res.status(200).json({ success: true, data: { settings } });
});

export const getSettingByKey = asyncHandler(async (req, res) => {
  const setting = await settingsService.getSetting(req.params.key, req.businessContext.businessId);
  if (!setting) return res.status(404).json({ success: false, message: 'Setting not found' });
  res.status(200).json({ success: true, data: { setting } });
});

export const updateSetting = asyncHandler(async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  const setting = await settingsService.updateSetting(key, value, req.businessContext.businessId);
  res.status(200).json({ success: true, message: 'Setting updated', data: { setting } });
});

export const updateMultiple = asyncHandler(async (req, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ success: false, message: 'Settings object required' });
  }
  const updated = await settingsService.updateMultipleSettings(settings, req.businessContext.businessId);
  res.status(200).json({ success: true, message: 'Settings updated', data: { updated } });
});

export const getPublic = asyncHandler(async (req, res) => {
  const businessId = req.businessContext?.businessId || req.query.businessId;
  if (!businessId) {
    return res.status(400).json({ success: false, message: 'Business ID required' });
  }
  const settings = await settingsService.getPublicSettings(businessId);
  res.status(200).json({ success: true, data: { settings } });
});
