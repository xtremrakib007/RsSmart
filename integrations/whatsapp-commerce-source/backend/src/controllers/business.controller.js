import { asyncHandler } from '../middleware/asyncHandler.js';
import { query } from '../database/connection.js';

export const getMyBusinesses = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT b.id, b.name, b.slug, b.phone, b.email, b.currency, b.timezone, b.status,
            r.name as role_name, r.id as role_id
     FROM business_users bu
     JOIN businesses b ON bu.business_id = b.id
     JOIN roles r ON bu.role_id = r.id
     WHERE bu.user_id = $1 AND bu.status = 'active' AND b.status = 'active'
     ORDER BY b.name`,
    [req.user.id]
  );
  res.status(200).json({ success: true, data: { businesses: result.rows } });
});

export const getBusinessById = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT * FROM businesses WHERE id = $1`,
    [req.params.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Business not found' });
  }
  res.status(200).json({ success: true, data: { business: result.rows[0] } });
});
