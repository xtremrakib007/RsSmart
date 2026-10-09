import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../push/push.service';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private push: PushService,
  ) {}

  async findAll(tenantId: string, filters?: { status?: string; customerId?: string; salesRepId?: string; outletId?: string; fromDate?: string; toDate?: string }) {
    const where: any = { tenantId };
    if (filters?.status) where.status = filters.status;
    if (filters?.customerId) where.customerId = filters.customerId;
    if (filters?.salesRepId) where.salesRepId = filters.salesRepId;
    if (filters?.outletId) where.outletId = filters.outletId;
    if (filters?.fromDate || filters?.toDate) {
      where.createdAt = {};
      if (filters.fromDate) where.createdAt.gte = new Date(filters.fromDate);
      if (filters.toDate) where.createdAt.lte = new Date(filters.toDate);
    }

    return this.prisma.order.findMany({
      where,
      include: {
        customer: true,
        salesRep: { omit: { password: true } },
        items: { include: { product: true } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        salesRep: { omit: { password: true } },
        items: { include: { product: true } },
        payments: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async create(tenantId: string, outletId: string, userId: string, data: any) {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new BadRequestException('An order must contain at least one item');
    }
    const [outlet, customer, salesRep] = await Promise.all([
      this.prisma.outlet.findFirst({ where: { id: outletId, tenantId, status: 'ACTIVE' }, select: { id: true } }),
      this.prisma.customer.findFirst({ where: { id: data.customerId, tenantId, isActive: true }, select: { id: true } }),
      this.prisma.user.findFirst({ where: { id: userId, tenantId, status: 'ACTIVE' }, select: { id: true } }),
    ]);
    if (!outlet) throw new BadRequestException('Outlet is not available for this company');
    if (!customer) throw new BadRequestException('Customer not found for this company');
    if (!salesRep) throw new BadRequestException('Sales user is not active in this company');

    const productIds = [...new Set(data.items.map((item: any) => item.productId).filter(Boolean))];
    if (productIds.length !== data.items.length) {
      throw new BadRequestException('Every order item must reference a product');
    }
    const products = await this.prisma.product.findMany({
      where: { tenantId, id: { in: productIds }, isActive: true },
      select: { id: true },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products are unavailable for this company');
    }

    // Calculate totals
    let subtotal = 0;
    let taxAmount = 0;
    const items = data.items.map((item: any) => {
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemTax = itemSubtotal * (item.taxRate || 0) / 100;
      const itemTotal = itemSubtotal + itemTax - (item.discount || 0);
      subtotal += itemSubtotal;
      taxAmount += itemTax;
      return {
        ...item,
        taxAmount: itemTax,
        total: itemTotal,
      };
    });

    const total = subtotal + taxAmount - (data.discount || 0);
    const orderNumber = await this.generateOrderNumber(tenantId);

    return this.prisma.order.create({
      data: {
        tenantId,
        outletId,
        orderNumber,
        customerId: data.customerId,
        salesRepId: userId,
        source: data.source || 'ERP',
        subtotal,
        taxAmount,
        discount: data.discount || 0,
        total,
        balanceDue: total,
        notes: data.notes,
        deliveryDate: data.deliveryDate,
        items: {
          create: items,
        },
      },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });
  }

  async updateStatus(id: string, tenantId: string, status: string, approvedBy?: string) {
    const updateData: any = { status };
    if (status === 'APPROVED') {
      updateData.approvedBy = approvedBy;
      updateData.approvedAt = new Date();
    }
    const order = await this.prisma.order.update({
      where: { id, tenantId },
      data: updateData,
      include: { customer: true, items: { include: { product: true } } },
    });

    // Sales order confirmation fires here — the moment an order is
    // APPROVED, not at raw creation (DRAFT/PENDING_APPROVAL isn't a
    // confirmed sale yet). This single choke point covers orders created
    // both via OrdersService.create() and via the offline sync processor
    // (src/sync/processors/sync-event.processor.ts), since both eventually
    // reach APPROVED through this method. POS is skipped entirely inside
    // NotificationsService. Fire-and-forget: never let a notification
    // failure fail the status update itself.
    if (status === 'APPROVED') {
      this.notifications
        .sendOrderConfirmationIfApplicable({
          orderNumber: order.orderNumber,
          total: Number(order.total),
          source: order.source,
          createdAt: order.createdAt,
          customer: order.customer,
          items: order.items,
        })
        .catch(() => {
          // NotificationsService already logs; this catch just guarantees
          // an unhandled rejection can never surface here.
        });

      // Push to the assigned sales rep's device(s) — this is the "order
      // approved/assigned" notification for the Sales App. Distinct from
      // the customer-facing email/WhatsApp confirmation above: this one
      // goes to internal staff and fires regardless of source (including
      // POS), since a sales rep should know when their order clears
      // approval even if the customer doesn't get a separate message.
      this.push
        .sendToUser(tenantId, order.salesRepId, {
          title: 'Order Approved',
          body: `Order ${order.orderNumber} has been approved.`,
          data: { type: 'ORDER_APPROVED', screen: 'order-detail', orderId: order.id },
        })
        .catch(() => {
          // PushService already logs; swallow so it never fails the update.
        });
    }

    return order;
  }

  async addPayment(id: string, tenantId: string, data: any) {
    const order = await this.findOne(id, tenantId);
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Payment amount must be a positive number');
    }
    const newPaid = Number(order.paidAmount) + amount;
    if (newPaid > Number(order.total) + 0.0001) {
      throw new BadRequestException('Payment exceeds the outstanding order balance');
    }
    const balanceDue = Math.max(0, Number(order.total) - newPaid);

    const [payment] = await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          orderId: id,
          amount,
          method: data.method,
          reference: data.reference,
          notes: data.notes,
          createdBy: data.createdBy,
        },
      }),
      this.prisma.order.update({
        where: { id, tenantId },
        data: { paidAmount: newPaid, balanceDue },
      }),
    ]);

    return payment;
  }

  private async generateOrderNumber(tenantId: string): Promise<string> {
    const date = new Date();
    const prefix = `ORD-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.prisma.order.count({
      where: {
        tenantId,
        orderNumber: { startsWith: prefix },
      },
    });
    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
  }
}
