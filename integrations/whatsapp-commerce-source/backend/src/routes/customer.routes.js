import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer
} from '../controllers/customer.controller.js';

const router = Router();

router.get('/', authenticate, getCustomers);
router.get('/:id', authenticate, getCustomer);
router.post('/', authenticate, createCustomer);
router.put('/:id', authenticate, updateCustomer);
router.delete('/:id', authenticate, deleteCustomer);

export default router;
