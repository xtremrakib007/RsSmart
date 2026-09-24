import { asyncHandler } from '../middleware/asyncHandler.js';
import * as customerService from '../services/customer.service.js';

export const getCustomers = asyncHandler(async (req, res) => {
  const customers = await customerService.getAllCustomers(req.query, req.businessContext.businessId);
  res.status(200).json({ success: true, data: { customers } });
});

export const getCustomer = asyncHandler(async (req, res) => {
  const customer = await customerService.getCustomerById(req.params.id, req.businessContext.businessId);
  if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
  res.status(200).json({ success: true, data: { customer } });
});

export const createCustomer = asyncHandler(async (req, res) => {
  const existing = await customerService.getCustomerByPhone(req.body.phone, req.businessContext.businessId);
  if (existing) {
    return res.status(409).json({ success: false, message: 'Customer with this phone already exists' });
  }
  const customer = await customerService.createCustomer(req.body, req.businessContext.businessId);
  res.status(201).json({ success: true, message: 'Customer created', data: { customer } });
});

export const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await customerService.updateCustomer(req.params.id, req.body, req.businessContext.businessId);
  if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
  res.status(200).json({ success: true, message: 'Customer updated', data: { customer } });
});

export const deleteCustomer = asyncHandler(async (req, res) => {
  const deleted = await customerService.deleteCustomer(req.params.id, req.businessContext.businessId);
  if (!deleted) return res.status(404).json({ success: false, message: 'Customer not found' });
  res.status(200).json({ success: true, message: 'Customer deleted' });
});
