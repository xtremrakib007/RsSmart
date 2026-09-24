import jwt from 'jsonwebtoken';
import { query } from '../database/connection.js';

const JWT_SECRET = process.env.JWT_SECRET || 'whatsapp-commerce-dev-secret-change-in-production';

/**
 * Authenticate JWT token and attach user to request.
 * Does NOT validate business context - that's done by requireBusinessContext.
 */
export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Load user with their business associations
    const userResult = await query(
      `SELECT u.id, u.email, u.full_name, u.is_active
       FROM users u
       WHERE u.id = $1`,
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found.'
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated.'
      });
    }

    // Load all business associations for this user
    const bizResult = await query(
      `SELECT bu.business_id, bu.role_id, r.name as role_name, bu.status as membership_status
       FROM business_users bu
       JOIN roles r ON bu.role_id = r.id
       WHERE bu.user_id = $1 AND bu.status = 'active'`,
      [user.id]
    );

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      businesses: bizResult.rows
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please log in again.'
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.'
    });
  }
};

/**
 * Generate JWT token with user ID.
 * Business context is determined at request time, not token time.
 */
export const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

export { JWT_SECRET };
