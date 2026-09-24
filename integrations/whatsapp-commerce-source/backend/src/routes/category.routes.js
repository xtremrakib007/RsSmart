import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getCategories, getCategory, createCategory, updateCategory, deleteCategory
} from '../controllers/category.controller.js';

const router = Router();

router.get('/', authenticate, getCategories);
router.get('/:id', authenticate, getCategory);
router.post('/', authenticate, createCategory);
router.put('/:id', authenticate, updateCategory);
router.delete('/:id', authenticate, deleteCategory);

export default router;
