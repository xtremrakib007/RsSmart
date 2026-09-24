import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as controller from '../controllers/admin.controller.js';

const router = Router();

router.use(authenticate);

router.get('/businesses', controller.getBusinesses);
router.get('/businesses/:id', controller.getBusinessDetails);

export default router;
