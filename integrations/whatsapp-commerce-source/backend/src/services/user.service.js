import bcrypt from 'bcryptjs';
import { query } from '../database/connection.js';

export const findUserByEmail = async (email) => {
  const result = await query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
};

export const findUserById = async (id) => {
  const result = await query(
    `SELECT u.id, u.email, u.full_name, u.is_active, u.created_at FROM users u WHERE u.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

export const createUser = async ({ email, password, fullName }) => {
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await query(
    `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, 'user')
     RETURNING id, email, full_name, is_active, created_at`,
    [email, passwordHash, fullName]
  );
  return result.rows[0];
};

export const verifyPassword = async (plainPassword, hashedPassword) => {
  return bcrypt.compare(plainPassword, hashedPassword);
};

export const getBusinessUsers = async (businessId) => {
  const result = await query(
    `SELECT u.id, u.email, u.full_name, bu.status as membership_status,
            r.name as role_name, bu.created_at as joined_at
     FROM business_users bu
     JOIN users u ON bu.user_id = u.id
     JOIN roles r ON bu.role_id = r.id
     WHERE bu.business_id = $1 ORDER BY bu.created_at DESC`,
    [businessId]
  );
  return result.rows;
};

export const addUserToBusiness = async (businessId, userId, roleId) => {
  const result = await query(
    `INSERT INTO business_users (business_id, user_id, role_id, status)
     VALUES ($1, $2, $3, 'active')
     ON CONFLICT (business_id, user_id) DO UPDATE
     SET role_id = EXCLUDED.role_id, status = 'active'
     RETURNING *`,
    [businessId, userId, roleId]
  );
  return result.rows[0];
};
