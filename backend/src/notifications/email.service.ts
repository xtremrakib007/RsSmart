import { Injectable, Logger } from '@nestjs/common';
import sgMail from '@sendgrid/mail';

interface OrderConfirmationEmail {
  to: string;
  orderNumber: string;
  total: number;
  createdAt: Date;
  items: Array<{ productName: string; quantity: number; total: number }>;
  customerName: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly enabled: boolean;

  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    this.enabled = !!apiKey;
    if (this.enabled) {
      sgMail.setApiKey(apiKey!);
    } else {
      this.logger.warn('SENDGRID_API_KEY not set — email confirmations are disabled.');
    }
  }

  /**
   * Sales order confirmation email. NOT sent for POS sales — POS is a
   * walk-in checkout with no order-confirmation step. Only orders placed
   * through the Sales App, ERP, or Web (source !== 'POS') trigger this.
   * See OrdersService.create().
   */
  async sendOrderConfirmation(order: OrderConfirmationEmail): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(`Skipping email to ${order.to} — SendGrid not configured.`);
      return;
    }

    const templateId = process.env.SENDGRID_ORDER_CONFIRMATION_TEMPLATE_ID;
    if (!templateId) {
      this.logger.warn('SENDGRID_ORDER_CONFIRMATION_TEMPLATE_ID not set — skipping email.');
      return;
    }

    try {
      await sgMail.send({
        to: order.to,
        from: process.env.SENDGRID_FROM_EMAIL || 'orders@yourcompany.com',
        templateId,
        dynamicTemplateData: {
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          date: order.createdAt,
          items: order.items,
          total: order.total,
        },
      });
    } catch (err) {
      // A failed confirmation email must never fail the order itself.
      this.logger.error(`Failed to send order confirmation email for ${order.orderNumber}`, err as Error);
    }
  }
}
