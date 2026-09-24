import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireBusinessContext } from '../middleware/businessContext.js';
import { requireBusinessAndRole } from '../middleware/authorization.js';
import {
  getInventory, getInventoryByProduct, getMovements, adjustStock, getLowStock
} from '../controllers/inventory.controller.js';

const router = Router();

router.use(authenticate);
router.use(requireBusinessContext);

router.get('/', getInventory);
router.get('/low-stock', getLowStock);
router.get('/:productId', getInventoryByProduct);
router.get('/:productId/movements', getMovements);
router.post('/:productId/adjust', requireBusinessAndRole('OWNER', 'ADMIN', 'MANAGER'), adjustStock);

export default router;
