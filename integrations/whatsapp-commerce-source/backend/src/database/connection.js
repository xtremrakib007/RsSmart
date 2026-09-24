import pg from 'pg';
import { dbConfig } from '../config/database.js';

const { Pool } = pg;

let pool = null;

export const connectDatabase = async () => {
  try {
    pool = new Pool(dbConfig);

    // Test connection
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();

    console.log('✅ PostgreSQL connected at:', result.rows[0].now);
    return pool;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    console.log('⚠️  Server will continue without database. Some features may not work.');
    return null;
  }
};

export const getPool = () => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call connectDatabase() first.');
  }
  return pool;
};

export const query = async (text, params) => {
  if (!pool) {
    throw new Error('Database not connected');
  }
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('Executed query', { text: text.substring(0, 50), duration, rows: result.rowCount });
  return result;
};
