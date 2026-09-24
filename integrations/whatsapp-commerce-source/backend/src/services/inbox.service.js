import { query, getPool } from '../database/connection.js';
import * as whatsappApi from './whatsappCloudApi.service.js';

export const getConversations = async (filters = {}, businessId) => {
  let sql = `SELECT 
      wc.*, 
      c.full_name as customer_name, 
      c.phone as customer_phone,
      c.customer_type,
      c.email as customer_email,
      c.company as customer_company,
      wcs.mode as conversation_mode,
      wcs.status as conversation_status,
      wcs.assigned_to,
      wcs.staff_handling,
      u.full_name as assigned_to_name
    FROM whatsapp_conversations wc
    LEFT JOIN customers c ON wc.customer_id = c.id
    LEFT JOIN whatsapp_conversation_states wcs ON wc.id = wcs.conversation_id
    LEFT JOIN users u ON wcs.assigned_to = u.id
    WHERE wc.business_id = $1`;

  const params = [businessId];
  let idx = 2;

  if (filters.status) {
    sql += ` AND wcs.status = $${idx}`;
    params.push(filters.status);
    idx++;
  }
  if (filters.mode) {
    sql += ` AND wcs.mode = $${idx}`;
    params.push(filters.mode);
    idx++;
  }
  if (filters.assignedToMe && filters.currentUserId) {
    sql += ` AND wcs.assigned_to = $${idx}`;
    params.push(filters.currentUserId);
    idx++;
  }
  if (filters.unassigned) {
    sql += ` AND wcs.assigned_to IS NULL`;
  }
  if (filters.search) {
    sql += ` AND (c.full_name ILIKE $${idx} OR c.phone ILIKE $${idx} OR wc.phone ILIKE $${idx})`;
    params.push(`%${filters.search}%`);
    idx++;
  }

  sql += ` ORDER BY wc.last_message_at DESC NULLS LAST`;

  const result = await query(sql, params);
  return result.rows;
};

export const getConversationById = async (id, businessId) => {
  const result = await query(
    `SELECT wc.*, c.full_name as customer_name, c.phone as customer_phone, c.customer_type,
     c.email as customer_email, c.company as customer_company,
     wcs.mode, wcs.status as conversation_status, wcs.assigned_to, wcs.staff_handling, wcs.state_data
     FROM whatsapp_conversations wc
     LEFT JOIN customers c ON wc.customer_id = c.id
     LEFT JOIN whatsapp_conversation_states wcs ON wc.id = wcs.conversation_id
     WHERE wc.id = $1 AND wc.business_id = $2`,
    [id, businessId]
  );
  return result.rows[0] || null;
};

export const getConversationMessages = async (conversationId, businessId) => {
  const result = await query(
    `SELECT wm.*, 
      CASE 
        WHEN wm.direction = 'inbound' THEN 'CUSTOMER'
        WHEN wm.direction = 'outbound' AND wm.sender_type = 'staff' THEN 'STAFF'
        WHEN wm.direction = 'outbound' THEN 'BOT'
        ELSE 'SYSTEM'
      END as sender_type
     FROM whatsapp_messages wm
     WHERE wm.conversation_id = $1 AND wm.business_id = $2
     ORDER BY wm.created_at ASC`,
    [conversationId, businessId]
  );
  return result.rows;
};

export const sendStaffReply = async (conversationId, content, userId, businessId) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const convResult = await client.query(
      `SELECT wc.*, c.full_name as customer_name FROM whatsapp_conversations wc
       LEFT JOIN customers c ON wc.customer_id = c.id
       WHERE wc.id = $1 AND wc.business_id = $2`,
      [conversationId, businessId]
    );
    if (convResult.rows.length === 0) throw new Error('Conversation not found.');
    const conversation = convResult.rows[0];

    // Send via WhatsApp API
    const result = await whatsappApi.sendText(
      businessId,
      conversation.phone,
      content,
      { conversationId, customerId: conversation.customer_id }
    );

    // Mark conversation as having staff activity
    await client.query(
      `UPDATE whatsapp_conversation_states 
       SET last_activity_at = NOW(), updated_at = NOW()
       WHERE conversation_id = $1 AND business_id = $2`,
      [conversationId, businessId]
    );

    // Reset unread count
    await client.query(
      `UPDATE whatsapp_conversations SET unread_count = 0, updated_at = NOW() WHERE id = $1`,
      [conversationId]
    );

    await client.query('COMMIT');
    return { success: true, messageId: result.messageId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const takeoverConversation = async (conversationId, userId, businessId) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const convResult = await client.query(
      `SELECT wc.*, wcs.mode FROM whatsapp_conversations wc
       LEFT JOIN whatsapp_conversation_states wcs ON wc.id = wcs.conversation_id
       WHERE wc.id = $1 AND wc.business_id = $2`,
      [conversationId, businessId]
    );
    if (convResult.rows.length === 0) throw new Error('Conversation not found.');

    const conversation = convResult.rows[0];

    await client.query(
      `INSERT INTO whatsapp_conversation_states (business_id, customer_id, conversation_id, mode, assigned_to, status, staff_handling)
       VALUES ($1, $2, $3, 'HUMAN', $4, 'OPEN', true)
       ON CONFLICT (business_id, customer_id, conversation_id)
       DO UPDATE SET mode = 'HUMAN', assigned_to = EXCLUDED.assigned_to, status = 'OPEN', staff_handling = true, updated_at = NOW()`,
      [businessId, conversation.customer_id, conversationId, userId]
    );

    await client.query(
      `INSERT INTO conversation_audit_log (business_id, conversation_id, action, old_value, new_value, user_id)
       VALUES ($1, $2, 'takeover', 'BOT', 'HUMAN', $3)`,
      [businessId, conversationId, userId]
    );

    await client.query(
      `INSERT INTO conversation_assignments (business_id, conversation_id, assigned_to, assigned_by, assigned_at)
       VALUES ($1, $2, $3, $3, NOW())`,
      [businessId, conversationId, userId]
    );

    // Notify customer
    await whatsappApi.sendText(
      businessId,
      conversation.phone,
      '💬 A staff member has joined the conversation. You can continue chatting normally.',
      { conversationId, customerId: conversation.customer_id }
    );

    await client.query('COMMIT');
    return { success: true, mode: 'HUMAN' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const returnToBot = async (conversationId, userId, businessId) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const convResult = await client.query(
      `SELECT wc.* FROM whatsapp_conversations wc WHERE wc.id = $1 AND wc.business_id = $2`,
      [conversationId, businessId]
    );
    if (convResult.rows.length === 0) throw new Error('Conversation not found.');
    const conversation = convResult.rows[0];

    await client.query(
      `UPDATE whatsapp_conversation_states 
       SET mode = 'BOT', staff_handling = false, assigned_to = NULL, status = 'OPEN', updated_at = NOW()
       WHERE conversation_id = $1 AND business_id = $2`,
      [conversationId, businessId]
    );

    await client.query(
      `INSERT INTO conversation_audit_log (business_id, conversation_id, action, old_value, new_value, user_id)
       VALUES ($1, $2, 'return_to_bot', 'HUMAN', 'BOT', $3)`,
      [businessId, conversationId, userId]
    );

    await whatsappApi.sendText(
      businessId,
      conversation.phone,
      '✅ You are back to automated service. Type "menu" to see options.',
      { conversationId, customerId: conversation.customer_id }
    );

    await client.query('COMMIT');
    return { success: true, mode: 'BOT' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const assignConversation = async (conversationId, assignedTo, assignedBy, businessId) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE whatsapp_conversation_states 
       SET assigned_to = $1, updated_at = NOW()
       WHERE conversation_id = $2 AND business_id = $3`,
      [assignedTo, conversationId, businessId]
    );

    await client.query(
      `INSERT INTO conversation_assignments (business_id, conversation_id, assigned_to, assigned_by, assigned_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [businessId, conversationId, assignedTo, assignedBy]
    );

    await client.query(
      `INSERT INTO conversation_audit_log (business_id, conversation_id, action, new_value, user_id)
       VALUES ($1, $2, 'assign', $3, $4)`,
      [businessId, conversationId, assignedTo, assignedBy]
    );

    await client.query('COMMIT');
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const unassignConversation = async (conversationId, userId, businessId) => {
  await query(
    `UPDATE whatsapp_conversation_states SET assigned_to = NULL, updated_at = NOW()
     WHERE conversation_id = $1 AND business_id = $2`,
    [conversationId, businessId]
  );

  await query(
    `INSERT INTO conversation_audit_log (business_id, conversation_id, action, user_id)
     VALUES ($1, $2, 'unassign', $3)`,
    [businessId, conversationId, userId]
  );

  return { success: true };
};

export const markConversationRead = async (conversationId, businessId) => {
  await query(
    `UPDATE whatsapp_conversations SET unread_count = 0, updated_at = NOW() WHERE id = $1 AND business_id = $2`,
    [conversationId, businessId]
  );
  return { success: true };
};

export const addNote = async (conversationId, note, userId, businessId) => {
  const result = await query(
    `INSERT INTO conversation_notes (business_id, conversation_id, user_id, note)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [businessId, conversationId, userId, note]
  );
  return result.rows[0];
};

export const getNotes = async (conversationId, businessId) => {
  const result = await query(
    `SELECT cn.*, u.full_name as user_name
     FROM conversation_notes cn
     LEFT JOIN users u ON cn.user_id = u.id
     WHERE cn.conversation_id = $1 AND cn.business_id = $2
     ORDER BY cn.created_at DESC`,
    [conversationId, businessId]
  );
  return result.rows;
};

export const getTags = async (businessId) => {
  const result = await query(
    `SELECT * FROM conversation_tags WHERE business_id = $1 ORDER BY name`,
    [businessId]
  );
  return result.rows;
};

export const addTagToConversation = async (conversationId, tagId, businessId) => {
  await query(
    `INSERT INTO conversation_tag_assignments (conversation_id, tag_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [conversationId, tagId]
  );
  return { success: true };
};

export const removeTagFromConversation = async (conversationId, tagId, businessId) => {
  await query(
    `DELETE FROM conversation_tag_assignments WHERE conversation_id = $1 AND tag_id = $2`,
    [conversationId, tagId]
  );
  return { success: true };
};

export const getConversationTags = async (conversationId, businessId) => {
  const result = await query(
    `SELECT ct.* FROM conversation_tags ct
     JOIN conversation_tag_assignments cta ON ct.id = cta.tag_id
     WHERE cta.conversation_id = $1 AND ct.business_id = $2`,
    [conversationId, businessId]
  );
  return result.rows;
};

export const archiveConversation = async (conversationId, userId, businessId) => {
  await query(
    `UPDATE whatsapp_conversation_states SET status = 'RESOLVED', updated_at = NOW()
     WHERE conversation_id = $1 AND business_id = $2`,
    [conversationId, businessId]
  );

  await query(
    `INSERT INTO conversation_audit_log (business_id, conversation_id, action, user_id)
     VALUES ($1, $2, 'archive', $3)`,
    [businessId, conversationId, userId]
  );

  return { success: true };
};

export const getCustomerInfo = async (customerId, businessId) => {
  const customerResult = await query(
    `SELECT * FROM customers WHERE id = $1 AND business_id = $2`,
    [customerId, businessId]
  );
  if (customerResult.rows.length === 0) return null;

  const customer = customerResult.rows[0];

  const ordersResult = await query(
    `SELECT * FROM orders WHERE customer_id = $1 AND business_id = $2 ORDER BY created_at DESC LIMIT 5`,
    [customerId, businessId]
  );

  const totalSpentResult = await query(
    `SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE customer_id = $1 AND business_id = $2 AND status NOT IN ('cancelled')`,
    [customerId, businessId]
  );

  const addressesResult = await query(
    `SELECT * FROM customer_addresses WHERE customer_id = $1 AND business_id = $2 ORDER BY is_default DESC`,
    [customerId, businessId]
  );

  return {
    ...customer,
    recentOrders: ordersResult.rows,
    totalSpent: totalSpentResult.rows[0]?.total || 0,
    addresses: addressesResult.rows
  };
};

// Staff availability
export const updateStaffAvailability = async (userId, businessId, status) => {
  await query(
    `INSERT INTO staff_availability (business_id, user_id, status, last_seen_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (business_id, user_id)
     DO UPDATE SET status = EXCLUDED.status, last_seen_at = NOW(), updated_at = NOW()`,
    [businessId, userId, status]
  );
  return { success: true };
};

export const getOnlineStaff = async (businessId) => {
  const result = await query(
    `SELECT sa.*, u.full_name, u.email FROM staff_availability sa
     JOIN users u ON sa.user_id = u.id
     WHERE sa.business_id = $1 AND sa.status = 'ONLINE'`,
    [businessId]
  );
  return result.rows;
};
