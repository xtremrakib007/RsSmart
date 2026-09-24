import { query } from '../database/connection.js';

const RATE_LIMITS = {
  default: { windowMs: 60 * 1000, max: 100 },
  auth: { windowMs: 15 * 60 * 1000, max: 5 },
  api: { windowMs: 60 * 1000, max: 60 },
  webhook: { windowMs: 60 * 1000, max: 30 },
};

export const rateLimit = (type = 'default') => {
  const config = RATE_LIMITS[type] || RATE_LIMITS.default;

  return async (req, res, next) => {
    const key = `${type}:${req.ip}:${req.user?.id || 'anonymous'}`;
    const windowStart = new Date(Date.now() - config.windowMs);

    try {
      // Clean old entries
      await query(`DELETE FROM rate_limit_logs WHERE window_start < $1`, [windowStart]);

      // Check current count
      const result = await query(
        `SELECT COALESCE(SUM(request_count), 0) as total FROM rate_limit_logs WHERE key = $1 AND window_start >= $2`,
        [key, windowStart]
      );
      const current = parseInt(result.rows[0].total, 10);

      if (current >= config.max) {
        return res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.'
        });
      }

      // Increment
      await query(
        `INSERT INTO rate_limit_logs (key, window_start, request_count)
         VALUES ($1, NOW(), 1)
         ON CONFLICT (key, window_start) DO UPDATE SET request_count = rate_limit_logs.request_count + 1`,
        [key, new Date()]
      );

      next();
    } catch (err) {
      console.error('Rate limit error:', err.message);
      next();
    }
  };
};
