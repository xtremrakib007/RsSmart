import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getSettings, getSettingByKey, updateSetting, updateMultiple, getPublic
} from '../controllers/settings.controller.js';

const router = Router();

router.get('/public', getPublic);
router.get('/', authenticate, getSettings);
router.get('/:key', authenticate, getSettingByKey);
router.put('/:key', authenticate, updateSetting);
router.put('/', authenticate, updateMultiple);

export default router;
