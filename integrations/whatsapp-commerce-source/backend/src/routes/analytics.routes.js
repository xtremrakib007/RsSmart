import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireBusinessContext } from '../middleware/businessContext.js';
import { requireBusinessAndRole } from '../middleware/authorization.js';
import {
  getSalesOverview,
  getTopProducts,
  getOrderStatusBreakdown,
  getCustomerGrowth,
  getRevenueByCategory,
  getRecentActivity,
  getDashboardSummary
} from '../controllers/analytics.controller.js';

const router = Router();

router.use(authenticate);
router.use(requireBusinessContext);

router.get('/summary', getDashboardSummary);
router.get('/sales', getSalesOverview);
router.get('/top-products', getTopProducts);
router.get('/status-breakdown', getOrderStatusBreakdown);
router.get('/customer-growth', getCustomerGrowth);
router.get('/revenue-by-category', getRevenueByCategory);
router.get('/recent-activity', getRecentActivity);

export default router;
