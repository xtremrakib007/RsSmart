import { asyncHandler } from '../middleware/asyncHandler.js';
import * as inboxService from '../services/inbox.service.js';

export const getConversations = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const filters = { ...req.query, currentUserId: req.user.id };
  const conversations = await inboxService.getConversations(filters, businessId);
  res.status(200).json({ success: true, data: { conversations } });
});

export const getConversation = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const conversation = await inboxService.getConversationById(req.params.id, businessId);
  if (!conversation) return res.status(404).json({ success: false, message: 'Not found' });
  res.status(200).json({ success: true, data: { conversation } });
});

export const getMessages = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const messages = await inboxService.getConversationMessages(req.params.id, businessId);
  res.status(200).json({ success: true, data: { messages } });
});

export const sendReply = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const userId = req.user.id;
  const { content } = req.body;
  const result = await inboxService.sendStaffReply(req.params.id, content, userId, businessId);
  res.status(200).json({ success: true, data: result });
});

export const takeover = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const userId = req.user.id;
  const result = await inboxService.takeoverConversation(req.params.id, userId, businessId);
  res.status(200).json({ success: true, data: result });
});

export const returnToBot = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const userId = req.user.id;
  const result = await inboxService.returnToBot(req.params.id, userId, businessId);
  res.status(200).json({ success: true, data: result });
});

export const assign = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const userId = req.user.id;
  const { assignedTo } = req.body;
  await inboxService.assignConversation(req.params.id, assignedTo, userId, businessId);
  res.status(200).json({ success: true });
});

export const unassign = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const userId = req.user.id;
  await inboxService.unassignConversation(req.params.id, userId, businessId);
  res.status(200).json({ success: true });
});

export const markRead = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  await inboxService.markConversationRead(req.params.id, businessId);
  res.status(200).json({ success: true });
});

export const addNote = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const userId = req.user.id;
  const note = await inboxService.addNote(req.params.id, req.body.note, userId, businessId);
  res.status(201).json({ success: true, data: { note } });
});

export const getNotes = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const notes = await inboxService.getNotes(req.params.id, businessId);
  res.status(200).json({ success: true, data: { notes } });
});

export const getTags = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const tags = await inboxService.getTags(businessId);
  res.status(200).json({ success: true, data: { tags } });
});

export const addTag = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  await inboxService.addTagToConversation(req.params.id, req.body.tagId, businessId);
  res.status(200).json({ success: true });
});

export const removeTag = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  await inboxService.removeTagFromConversation(req.params.id, req.body.tagId, businessId);
  res.status(200).json({ success: true });
});

export const archive = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const userId = req.user.id;
  await inboxService.archiveConversation(req.params.id, userId, businessId);
  res.status(200).json({ success: true });
});

export const getCustomerInfo = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const conversation = await inboxService.getConversationById(req.params.id, businessId);
  if (!conversation) return res.status(404).json({ success: false, message: 'Not found' });
  const info = await inboxService.getCustomerInfo(conversation.customer_id, businessId);
  res.status(200).json({ success: true, data: { customer: info } });
});

export const updateAvailability = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const userId = req.user.id;
  const { status } = req.body;
  await inboxService.updateStaffAvailability(userId, businessId, status);
  res.status(200).json({ success: true });
});

export const getOnlineStaff = asyncHandler(async (req, res) => {
  const businessId = req.businessContext.businessId;
  const staff = await inboxService.getOnlineStaff(businessId);
  res.status(200).json({ success: true, data: { staff } });
});
