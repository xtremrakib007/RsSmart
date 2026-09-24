import { asyncHandler } from '../middleware/asyncHandler.js';
import * as checkoutService from '../services/checkout.service.js';

export const checkout = asyncHandler(async (req, res) => {
  const { customerId, deliveryAddressId, deliveryMethod, notes } = req.body;

  if (!customerId) {
    return res.status(400).json({ success: false, message: 'customerId is required' });
  }

  try {
    const result = await checkoutService.checkout({
      businessId: req.businessContext.businessId,
      customerId,
      deliveryAddressId,
      deliveryMethod: deliveryMethod || 'delivery',
      notes,
      userId: req.user?.id
    });

    res.status(201).json({
      success: true,
      message: result.message,
      data: {
        order: result.order,
        orderItems: result.orderItems,
        totalAmount: result.totalAmount
      }
    });
  } catch (error) {
    if (error.message.startsWith('VALIDATION_FAILED:')) {
      return res.status(422).json({
        success: false,
        message: 'Cart validation failed',
        error: error.message.replace('VALIDATION_FAILED: ', ''),
        code: 'VALIDATION_FAILED'
      });
    }
    if (error.message.includes('PRICE_CHANGED')) {
      return res.status(422).json({
        success: false,
        message: 'Prices have changed since items were added to cart',
        code: 'PRICE_CHANGED'
      });
    }
    if (error.message.includes('Insufficient stock')) {
      return res.status(422).json({
        success: false,
        message: error.message,
        code: 'INSUFFICIENT_STOCK'
      });
    }
    throw error;
  }
});
