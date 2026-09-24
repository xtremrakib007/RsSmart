import { query } from '../database/connection.js';
import * as whatsappCloudApi from './whatsappCloudApi.service.js';

export const sendOrderStatusNotification = async (orderId, status, customerPhone, businessId) => {
  let phone = customerPhone;
  let customerName = 'Customer';

  if (!phone) {
    const result = await query(
      `SELECT c.phone, c.full_name, o.total_amount FROM orders o
       JOIN customers c ON o.customer_id = c.id WHERE o.id = $1 AND o.business_id = $2`,
      [orderId, businessId]
    );
    if (result.rows.length === 0) return { success: false, message: 'Customer not found' };
    phone = result.rows[0].phone;
    customerName = result.rows[0].full_name;
  }

  const statusMessages = {
    pending: `Hi ${customerName}, your order has been received and is pending confirmation.`,
    confirmed: `Great news ${customerName}! Your order has been confirmed and will be processed shortly.`,
    processing: `Hi ${customerName}, your order is now being processed. We will update you once it ships.`,
    shipped: `Hi ${customerName}, your order has been shipped! It is on its way to you.`,
    delivered: `Hi ${customerName}, your order has been delivered. Thank you for shopping with us!`,
    cancelled: `Hi ${customerName}, your order has been cancelled. Please contact us if you have questions.`
  };

  const message = statusMessages[status] || `Your order status has been updated to: ${status}`;

  try {
    const result = await whatsappCloudApi.sendText(businessId, phone, message);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Failed to send notification:', error.message);
    return { success: false, message: error.message };
  }
};

export const sendTemplateMessage = async (phone, templateName, variables, businessId) => {
  const result = await query(
    `SELECT * FROM message_templates WHERE name = $1 AND is_active = true AND business_id = $2`,
    [templateName, businessId]
  );
  if (result.rows.length === 0) throw new Error(`Template "${templateName}" not found.`);

  const template = result.rows[0];
  let message = template.body;
  Object.entries(variables || {}).forEach(([key, value]) => {
    message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
  });

  const sendResult = await whatsappCloudApi.sendText(businessId, phone, message);
  return { success: true, messageId: sendResult.messageId };
};
