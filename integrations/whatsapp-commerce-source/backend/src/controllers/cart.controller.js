import { asyncHandler } from '../middleware/asyncHandler.js';
import * as cartService from '../services/cart.service.js';

export const getCart = asyncHandler(async (req, res) => {
  const { customerId } = req.query;
  if (!customerId) {
    return res.status(400).json({ success: false, message: 'customerId is required' });
  }
  const cart = await cartService.getCartByCustomer(req.businessContext.businessId, customerId);
  if (!cart) {
    return res.status(200).json({ success: true, data: { cart: { items: [], total: 0, itemCount: 0 } } });
  }
  res.status(200).json({ success: true, data: { cart } });
});

export const addItem = asyncHandler(async (req, res) => {
  const { customerId, productId, quantity } = req.body;
  if (!customerId || !productId || !quantity) {
    return res.status(400).json({ success: false, message: 'customerId, productId, and quantity are required' });
  }
  const result = await cartService.addItemToCart({
    businessId: req.businessContext.businessId,
    customerId,
    productId,
    quantity: parseInt(quantity)
  });
  const cart = await cartService.getCartById(result.cartId, req.businessContext.businessId);
  res.status(201).json({ success: true, message: 'Item added to cart', data: { cart } });
});

export const updateItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  if (!quantity || quantity < 1) {
    return res.status(400).json({ success: false, message: 'quantity must be at least 1' });
  }
  const item = await cartService.updateCartItemQuantity({
    cartItemId: req.params.id,
    quantity: parseInt(quantity),
    businessId: req.businessContext.businessId
  });
  res.status(200).json({ success: true, message: 'Cart item updated', data: { item } });
});

export const removeItem = asyncHandler(async (req, res) => {
  const deleted = await cartService.removeCartItem(req.params.id, req.businessContext.businessId);
  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Cart item not found' });
  }
  res.status(200).json({ success: true, message: 'Item removed from cart' });
});

export const clearCart = asyncHandler(async (req, res) => {
  const { customerId } = req.query;
  if (!customerId) {
    return res.status(400).json({ success: false, message: 'customerId is required' });
  }
  const cart = await cartService.getCartByCustomer(req.businessContext.businessId, customerId);
  if (cart) {
    await cartService.clearCart(cart.id, req.businessContext.businessId);
  }
  res.status(200).json({ success: true, message: 'Cart cleared' });
});

export const validateCart = asyncHandler(async (req, res) => {
  const { customerId } = req.query;
  if (!customerId) {
    return res.status(400).json({ success: false, message: 'customerId is required' });
  }
  const cart = await cartService.getCartByCustomer(req.businessContext.businessId, customerId);
  if (!cart) {
    return res.status(400).json({ success: false, message: 'Cart not found' });
  }
  const validation = await cartService.validateCart(cart.id, req.businessContext.businessId);
  res.status(200).json({ success: true, data: validation });
});
