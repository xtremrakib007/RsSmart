import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getProducts, getProduct, createProduct, updateProduct, deleteProduct, getLowStock
} from '../controllers/product.controller.js';

const router = Router();

router.get('/', authenticate, getProducts);
router.get('/low-stock', authenticate, getLowStock);
router.get('/:id', authenticate, getProduct);
router.post('/', authenticate, createProduct);
router.put('/:id', authenticate, updateProduct);
router.delete('/:id', authenticate, deleteProduct);

export default router;
