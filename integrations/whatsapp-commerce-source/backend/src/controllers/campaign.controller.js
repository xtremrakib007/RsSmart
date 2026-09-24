import { asyncHandler } from '../middleware/asyncHandler.js';
import * as campaignService from '../services/campaign.service.js';

export const getCampaigns = asyncHandler(async (req, res) => {
  const data = await campaignService.getCampaigns(req.query, req.businessContext.businessId);
  res.status(200).json({ success: true, data: { campaigns: data } });
});

export const getCampaign = asyncHandler(async (req, res) => {
  const data = await campaignService.getCampaignById(req.params.id, req.businessContext.businessId);
  if (!data) return res.status(404).json({ success: false, message: 'Campaign not found.' });
  res.status(200).json({ success: true, data: { campaign: data } });
});

export const createCampaign = asyncHandler(async (req, res) => {
  const data = await campaignService.createCampaign(req.body, req.user.id, req.businessContext.businessId);
  res.status(201).json({ success: true, data: { campaign: data } });
});

export const updateCampaign = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (status) {
    const data = await campaignService.updateCampaignStatus(req.params.id, req.businessContext.businessId, status);
    if (!data) return res.status(404).json({ success: false, message: 'Campaign not found.' });
    return res.status(200).json({ success: true, data: { campaign: data } });
  }
  res.status(400).json({ success: false, message: 'No valid fields to update.' });
});

export const deleteCampaign = asyncHandler(async (req, res) => {
  const data = await campaignService.updateCampaignStatus(req.params.id, req.businessContext.businessId, 'CANCELLED');
  if (!data) return res.status(404).json({ success: false, message: 'Campaign not found.' });
  res.status(200).json({ success: true, message: 'Campaign cancelled.' });
});

export const queueCampaign = asyncHandler(async (req, res) => {
  const result = await campaignService.queueCampaign(req.params.id, req.businessContext.businessId);
  res.status(200).json({ success: true, data: result });
});

export const getCampaignStats = asyncHandler(async (req, res) => {
  const data = await campaignService.getCampaignStats(req.params.id, req.businessContext.businessId);
  res.status(200).json({ success: true, data });
});

export const getCampaignAudience = asyncHandler(async (req, res) => {
  const data = await campaignService.buildAudience(req.params.id, req.businessContext.businessId);
  res.status(200).json({ success: true, data: { audience: data, count: data.length } });
});
