import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireBusinessContext } from '../middleware/businessContext.js';
import { requireBusinessAndRole } from '../middleware/authorization.js';
import {
  getPrice, getPriceLevels, createPriceLevel, updatePriceLevel, deletePriceLevel,
  getProductPrices, setProductPrice, deleteProductPrice,
  getQuantityRules, createQuantityRule, updateQuantityRule, deleteQuantityRule,
  getCustomerPriceLevel, setCustomerPriceLevel
} from '../controllers/pricing.controller.js';

const router = Router();

router.use(authenticate);
router.use(requireBusinessContext);

// Price calculation
router.get('/calculate', getPrice);

// Price levels
router.get('/levels', getPriceLevels);
router.post('/levels', requireBusinessAndRole('OWNER', 'ADMIN'), createPriceLevel);
router.put('/levels/:id', requireBusinessAndRole('OWNER', 'ADMIN'), updatePriceLevel);
router.delete('/levels/:id', requireBusinessAndRole('OWNER', 'ADMIN'), deletePriceLevel);

// Product prices
router.get('/products/:productId', getProductPrices);
router.post('/products/:productId', requireBusinessAndRole('OWNER', 'ADMIN', 'MANAGER'), setProductPrice);
router.delete('/products/:productId/prices/:priceId', requireBusinessAndRole('OWNER', 'ADMIN'), deleteProductPrice);

// Quantity rules
router.get('/products/:productId/rules', getQuantityRules);
router.post('/products/:productId/rules', requireBusinessAndRole('OWNER', 'ADMIN', 'MANAGER'), createQuantityRule);
router.put('/products/:productId/rules/:ruleId', requireBusinessAndRole('OWNER', 'ADMIN', 'MANAGER'), updateQuantityRule);
router.delete('/products/:productId/rules/:ruleId', requireBusinessAndRole('OWNER', 'ADMIN'), deleteQuantityRule);

// Customer price levels
router.get('/customers/:customerId', getCustomerPriceLevel);
router.post('/customers/:customerId', requireBusinessAndRole('OWNER', 'ADMIN', 'MANAGER'), setCustomerPriceLevel);

export default router;
