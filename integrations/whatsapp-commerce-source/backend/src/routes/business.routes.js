import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getMyBusinesses, getBusinessById } from '../controllers/business.controller.js';

const router = Router();

router.use(authenticate);
router.get('/my', getMyBusinesses);
router.get('/:id', getBusinessById);

export default router;
