import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from './email.service';
import { WhatsAppService } from './whatsapp.service';

interface OrderForConfirmation {
  orderNumber: string;
  total: number;
  source: string; // OrderSource: SALES_APP | ERP | POS | WEB
  createdAt: Date;
  customer: {
    name: string;
    email?: string | null;
    phone?: string | null;
  };
  items: Array<{ quantity: number; total: number; product: { name: string } }>;
  receiptUrl?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly email: EmailService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  /**
   * Sends an order-confirmation notification (email + WhatsApp), but ONLY
   * for sales orders — not POS. POS is a walk-in checkout: the customer is
   * standing at the register and gets a printed/on-screen receipt, so there
   * is no separate confirmation step.
   *
   * Call this after OrdersService.create() persists the order. Never throws
   * — a notification failure must not roll back or fail the order.
   */
  async sendOrderConfirmationIfApplicable(order: OrderForConfirmation): Promise<void> {
    if (order.source === 'POS') {
      this.logger.debug(`Order ${order.orderNumber} is a POS sale — skipping confirmation.`);
      return;
    }

    const tasks: Promise<void>[] = [];

    if (order.customer.email) {
      tasks.push(
        this.email.sendOrderConfirmation({
          to: order.customer.email,
          orderNumber: order.orderNumber,
          total: order.total,
          createdAt: order.createdAt,
          customerName: order.customer.name,
          items: order.items.map((i) => ({
            productName: i.product.name,
            quantity: i.quantity,
            total: i.total,
          })),
        }),
      );
    }

    if (order.customer.phone) {
      tasks.push(
        this.whatsapp.sendOrderConfirmation({
          to: order.customer.phone,
          orderNumber: order.orderNumber,
          total: order.total,
          receiptUrl: order.receiptUrl,
        }),
      );
    }

    if (tasks.length === 0) {
      this.logger.warn(`Order ${order.orderNumber} has no customer email or phone — no confirmation sent.`);
      return;
    }

    await Promise.all(tasks);
  }
}
