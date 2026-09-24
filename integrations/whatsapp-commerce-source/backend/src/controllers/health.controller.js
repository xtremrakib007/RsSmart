import { asyncHandler } from '../middleware/asyncHandler.js';
import { getPool } from '../database/connection.js';

export const getHealth = asyncHandler(async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    const pool = getPool();
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'error';
  }

  res.status(200).json({
    success: true,
    service: 'whatsapp-commerce-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    checks: {
      database: dbStatus,
    }
  });
});
