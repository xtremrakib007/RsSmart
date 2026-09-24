import { query } from '../database/connection.js';

export const getTickets = async (filters, businessId = null) => {
  let sql = `SELECT t.*, u.full_name as user_name, assignee.full_name as assigned_to_name
             FROM support_tickets t
             JOIN users u ON t.user_id = u.id
             LEFT JOIN users assignee ON t.assigned_to = assignee.id
             WHERE 1=1`;
  const params = [];
  let idx = 1;
  if (businessId) { sql += ` AND t.business_id = $${idx}`; params.push(businessId); idx++; }
  if (filters.status) { sql += ` AND t.status = $${idx}`; params.push(filters.status); idx++; }
  if (filters.priority) { sql += ` AND t.priority = $${idx}`; params.push(filters.priority); idx++; }
  sql += ` ORDER BY t.created_at DESC`;
  const result = await query(sql, params);
  return result.rows;
};

export const getTicketById = async (id, businessId) => {
  const result = await query(
    `SELECT t.*, u.full_name as user_name, assignee.full_name as assigned_to_name
     FROM support_tickets t
     JOIN users u ON t.user_id = u.id
     LEFT JOIN users assignee ON t.assigned_to = assignee.id
     WHERE t.id = $1 AND t.business_id = $2`,
    [id, businessId]
  );
  if (result.rows.length === 0) return null;
  const ticket = result.rows[0];
  const repliesResult = await query(
    `SELECT r.*, u.full_name as user_name FROM support_ticket_replies r
     JOIN users u ON r.user_id = u.id WHERE r.ticket_id = $1 ORDER BY r.created_at ASC`,
    [id]
  );
  ticket.replies = repliesResult.rows;
  return ticket;
};

export const createTicket = async ({ subject, description, priority = 'MEDIUM', category = 'general' }, businessId, userId) => {
  const result = await query(
    `INSERT INTO support_tickets (business_id, user_id, subject, description, priority, status, category)
     VALUES ($1,$2,$3,$4,$5,'OPEN',$6) RETURNING *`,
    [businessId, userId, subject, description, priority, category]
  );
  return result.rows[0];
};

export const replyToTicket = async (ticketId, { message, isInternal = false }, userId) => {
  const result = await query(
    `INSERT INTO support_ticket_replies (ticket_id, user_id, message, is_internal)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [ticketId, userId, message, isInternal]
  );
  // Update ticket status if not closed
  await query(
    `UPDATE support_tickets SET status = CASE WHEN status = 'WAITING' THEN 'IN_PROGRESS' ELSE status END, updated_at = NOW()
     WHERE id = $1 AND status != 'CLOSED'`,
    [ticketId]
  );
  return result.rows[0];
};

export const updateTicketStatus = async (ticketId, businessId, status, assignedTo = null) => {
  const sets = [`status = $3`];
  const params = [ticketId, businessId, status];
  if (status === 'RESOLVED') { sets.push(`resolved_at = NOW()`); }
  if (status === 'CLOSED') { sets.push(`closed_at = NOW()`); }
  if (assignedTo) { sets.push(`assigned_to = $4`); params.push(assignedTo); }
  sets.push(`updated_at = NOW()`);
  const result = await query(
    `UPDATE support_tickets SET ${sets.join(', ')} WHERE id = $1 AND business_id = $2 RETURNING *`,
    params
  );
  return result.rows[0] || null;
};

export const createFeedback = async ({ type, subject, description }, businessId, userId) => {
  const result = await query(
    `INSERT INTO feedback (business_id, user_id, type, subject, description)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [businessId, userId, type, subject, description]
  );
  return result.rows[0];
};

export const getFeedback = async (businessId) => {
  const result = await query(
    `SELECT f.*, u.full_name as user_name FROM feedback f
     JOIN users u ON f.user_id = u.id WHERE f.business_id = $1 ORDER BY f.created_at DESC`,
    [businessId]
  );
  return result.rows;
};

export const createAnnouncement = async ({ title, content, targetType, targetPlanId, targetBusinessIds }, createdBy) => {
  const result = await query(
    `INSERT INTO platform_announcements (title, content, target_type, target_plan_id, target_business_ids, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [title, content, targetType, targetPlanId || null, targetBusinessIds || null, createdBy]
  );
  return result.rows[0];
};

export const publishAnnouncement = async (id) => {
  const result = await query(
    `UPDATE platform_announcements SET is_published = true, published_at = NOW(), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
};

export const getAnnouncementsForBusiness = async (businessId, planId) => {
  const result = await query(
    `SELECT a.*, ar.read_at
     FROM platform_announcements a
     LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.business_id = $1
     WHERE a.is_published = true
       AND (a.expires_at IS NULL OR a.expires_at > NOW())
       AND (
         a.target_type = 'all'
         OR (a.target_type = 'plan' AND a.target_plan_id = $2)
         OR (a.target_type = 'businesses' AND $1 = ANY(a.target_business_ids))
       )
     ORDER BY a.published_at DESC`,
    [businessId, planId]
  );
  return result.rows;
};

export const markAnnouncementRead = async (announcementId, businessId, userId) => {
  await query(
    `INSERT INTO announcement_reads (announcement_id, business_id, user_id)
     VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
    [announcementId, businessId, userId]
  );
};
