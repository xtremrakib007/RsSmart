import { Injectable, Logger } from '@nestjs/common';
import twilio from 'twilio';

interface OrderConfirmationWhatsApp {
  to: string; // customer phone, E.164 format e.g. +60123456789
  orderNumber: string;
  total: number;
  receiptUrl?: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly client: ReturnType<typeof twilio> | null;
  private readonly enabled: boolean;

  constructor() {
    const sid = process.env.TWILIO_SID;
    const token = process.env.TWILIO_TOKEN;
    this.enabled = !!(sid && token && process.env.TWILIO_WHATSAPP_NUMBER);
    this.client = this.enabled ? twilio(sid, token) : null;
    if (!this.enabled) {
      this.logger.warn(
        'TWILIO_SID / TWILIO_TOKEN / TWILIO_WHATSAPP_NUMBER not fully set — WhatsApp confirmations are disabled.',
      );
    }
  }

  /**
   * Sales order confirmation via WhatsApp. NOT sent for POS sales — see
   * EmailService.sendOrderConfirmation for the same rule. Only fires from
   * OrdersService.create() when order.source !== 'POS'.
   *
   * Requires a Twilio number approved for the WhatsApp Business API
   * (TWILIO_WHATSAPP_NUMBER, e.g. "whatsapp:+14155238886"). The Twilio
   * sandbox number works for development but only messages numbers that
   * have joined the sandbox; production requires Meta business verification.
   */
  async sendOrderConfirmation(order: OrderConfirmationWhatsApp): Promise<void> {
    if (!this.enabled || !this.client) {
      this.logger.debug(`Skipping WhatsApp message to ${order.to} — Twilio not configured.`);
      return;
    }

    const body = order.receiptUrl
      ? `Thanks for your order #${order.orderNumber}! Total: ${order.total.toFixed(2)}. View your receipt: ${order.receiptUrl}`
      : `Thanks for your order #${order.orderNumber}! Total: ${order.total.toFixed(2)}.`;

    try {
      await this.client.messages.create({
        body,
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: `whatsapp:${order.to}`,
      });
    } catch (err) {
      // A failed confirmation message must never fail the order itself.
      this.logger.error(`Failed to send WhatsApp confirmation for ${order.orderNumber}`, err as Error);
    }
  }
}
