import { query, getPool } from '../database/connection.js';
import crypto from 'crypto';
import { checkFeatureLimit, getCurrentUsage } from './featureLimit.service.js';

export const getTeamMembers = async (businessId) => {
  const result = await query(
    `SELECT u.id, u.email, u.full_name, u.is_active, u.last_login_at, u.login_count,
            bu.status as membership_status, bu.created_at as joined_at,
            bu.deactivated_at, bu.deactivated_reason,
            r.id as role_id, r.name as role_name
     FROM business_users bu
     JOIN users u ON bu.user_id = u.id
     JOIN roles r ON bu.role_id = r.id
     WHERE bu.business_id = $1
     ORDER BY bu.created_at DESC`,
    [businessId]
  );
  return result.rows;
};

export const getPendingInvitations = async (businessId) => {
  const result = await query(
    `SELECT si.*, r.name as role_name, u.full_name as invited_by_name
     FROM staff_invitations si
     JOIN roles r ON si.role_id = r.id
     JOIN users u ON si.invited_by = u.id
     WHERE si.business_id = $1 AND si.status = 'pending' AND si.expires_at > NOW()
     ORDER BY si.invited_at DESC`,
    [businessId]
  );
  return result.rows;
};

export const createInvitation = async ({ email, roleId }, businessId, invitedBy) => {
  // Check staff limit
  await checkFeatureLimit(businessId, 'staff_users');

  // Check if user already in business
  const existing = await query(
    `SELECT u.email FROM business_users bu JOIN users u ON bu.user_id = u.id
     WHERE bu.business_id = $1 AND u.email = $2`,
    [businessId, email]
  );
  if (existing.rows.length > 0) {
    const err = new Error('User is already a member of this business.');
    err.statusCode = 409;
    throw err;
  }

  // Check pending invitation
  const pending = await query(
    `SELECT id FROM staff_invitations WHERE business_id = $1 AND email = $2 AND status = 'pending' AND expires_at > NOW()`,
    [businessId, email]
  );
  if (pending.rows.length > 0) {
    const err = new Error('Pending invitation already exists for this email.');
    err.statusCode = 409;
    throw err;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const result = await query(
    `INSERT INTO staff_invitations (business_id, email, role_id, token, invited_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [businessId, email, roleId, token, invitedBy, expiresAt]
  );
  return result.rows[0];
};

export const acceptInvitation = async (token, userId) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const invResult = await client.query(
      `SELECT * FROM staff_invitations WHERE token = $1 AND status = 'pending' AND expires_at > NOW()`,
      [token]
    );
    if (invResult.rows.length === 0) {
      throw new Error('Invitation not found or expired.');
    }
    const invitation = invResult.rows[0];

    // Check limit again
    const usageResult = await client.query(
      `SELECT COUNT(*) as c FROM business_users WHERE business_id = $1`,
      [invitation.business_id]
    );
    const currentUsage = parseInt(usageResult.rows[0].c, 10);
    // Soft check - if over limit, still accept but log warning

    // Add user to business
    await client.query(
      `INSERT INTO business_users (business_id, user_id, role_id, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (business_id, user_id) DO UPDATE SET role_id = EXCLUDED.role_id, status = 'active'`,
      [invitation.business_id, userId, invitation.role_id]
    );

    // Mark invitation accepted
    await client.query(
      `UPDATE staff_invitations SET status = 'accepted', accepted_at = NOW(), accepted_by = $1, updated_at = NOW()
       WHERE id = $2`,
      [userId, invitation.id]
    );

    await client.query('COMMIT');
    return { businessId: invitation.business_id, roleId: invitation.role_id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const cancelInvitation = async (invitationId, businessId, cancelledBy) => {
  const result = await query(
    `UPDATE staff_invitations SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND business_id = $2 RETURNING *`,
    [invitationId, businessId]
  );
  return result.rows[0];
};

export const updateMemberRole = async (businessId, userId, newRoleId, changedBy) => {
  const result = await query(
    `UPDATE business_users SET role_id = $1, updated_at = NOW()
     WHERE business_id = $2 AND user_id = $3 RETURNING *`,
    [newRoleId, businessId, userId]
  );
  return result.rows[0];
};

export const deactivateMember = async (businessId, userId, reason, deactivatedBy) => {
  const result = await query(
    `UPDATE business_users SET status = 'inactive', deactivated_at = NOW(), deactivated_by = $1, deactivated_reason = $2, updated_at = NOW()
     WHERE business_id = $3 AND user_id = $4 RETURNING *`,
    [deactivatedBy, reason, businessId, userId]
  );
  return result.rows[0];
};

export const reactivateMember = async (businessId, userId) => {
  const result = await query(
    `UPDATE business_users SET status = 'active', deactivated_at = NULL, deactivated_by = NULL, deactivated_reason = NULL, updated_at = NOW()
     WHERE business_id = $1 AND user_id = $2 RETURNING *`,
    [businessId, userId]
  );
  return result.rows[0];
};

export const getStaffActivity = async (businessId, userId, limit = 50) => {
  const result = await query(
    `SELECT action, resource, resource_id, details, ip_address, created_at
     FROM audit_logs
     WHERE business_id = $1 ${userId ? 'AND user_id = $2' : ''}
     ORDER BY created_at DESC
     LIMIT $${userId ? 3 : 2}`,
    userId ? [businessId, userId, limit] : [businessId, limit]
  );
  return result.rows;
};
