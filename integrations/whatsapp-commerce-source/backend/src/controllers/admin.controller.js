import { asyncHandler } from '../middleware/asyncHandler.js';
import { query } from '../database/connection.js';
import { getBusinessSubscription } from '../services/subscription.service.js';

export const getBusinesses = asyncHandler(async (req, res) => {
  // Platform admin only - check system role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Platform admin access required.' });
  }

  const result = await query(
    `SELECT b.*,
      (SELECT COUNT(*) FROM users u JOIN business_users bu ON bu.user_id = u.id WHERE bu.business_id = b.id) as staff_count,
      (SELECT COUNT(*) FROM customers WHERE business_id = b.id) as customer_count,
      (SELECT COUNT(*) FROM orders WHERE business_id = b.id AND status != 'cancelled') as order_count,
      (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE business_id = b.id AND status != 'cancelled') as total_revenue
     FROM businesses b
     ORDER BY b.created_at DESC`,
    []
  );

  const businesses = [];
  for (const biz of result.rows) {
    const sub = await getBusinessSubscription(biz.id);
    businesses.push({ ...biz, subscription: sub });
  }

  res.status(200).json({ success: true, data: { businesses } });
});

export const getBusinessDetails = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Platform admin access required.' });
  }

  const result = await query(
    `SELECT * FROM businesses WHERE id = $1`,
    [req.params.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Business not found.' });
  }

  const sub = await getBusinessSubscription(req.params.id);
  res.status(200).json({ success: true, data: { business: result.rows[0], subscription: sub } });
});
