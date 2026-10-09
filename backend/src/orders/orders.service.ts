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

    if (data.items.some((item: any) => typeof item?.productId !== 'string' || !item.productId)) {
      throw new BadRequestException('Every order item must reference a product');
    }
    const productIds = [...new Set(data.items.map((item: any) => item.productId))];
    const products = await this.prisma.product.findMany({
      where: { tenantId, id: { in: productIds }, isActive: true },
      select: { id: true, basePrice: true, taxRate: true },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products are unavailable for this company');
    }
    const productsById = new Map(products.map((product) => [product.id, product]));

    // Prices and tax rates are authoritative catalog values. Never trust
    // client-supplied unitPrice/taxRate: a modified request must not reduce
    // the order total. Explicit discounts remain subject to validation.
    let subtotal = 0;
    let taxAmount = 0;
    let itemDiscountTotal = 0;
    const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
    const items = data.items.map((item: any) => {
      const product = productsById.get(item.productId);
      if (!product) throw new BadRequestException('One or more products are unavailable for this company');
      const quantity = Number(item.quantity);
      const unitPrice = Number(product.basePrice);
      const taxRate = Number(product.taxRate);
      const discount = Number(item.discount ?? 0);
      if (!Number.isFinite(quantity) || quantity <= 0 ||
          !Number.isFinite(unitPrice) || unitPrice < 0 ||
          !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100 ||
          !Number.isFinite(discount) || discount < 0) {
        throw new BadRequestException('Order item quantity or discount is invalid');
      }
      const itemSubtotal = money(quantity * unitPrice);
      if (discount > itemSubtotal) {
        throw new BadRequestException('An item discount cannot exceed its subtotal');
      }
      const itemTax = money((itemSubtotal - discount) * taxRate / 100);
      const itemTotal = money(itemSubtotal + itemTax - discount);
      subtotal = money(subtotal + itemSubtotal);
      taxAmount = money(taxAmount + itemTax);
      itemDiscountTotal = money(itemDiscountTotal + discount);
      return {
        productId: item.productId,
        quantity,
        unitPrice,
        taxRate,
        discount: money(discount),
        ...(typeof item.notes === 'string' ? { notes: item.notes.slice(0, 1000) } : {}),
        taxAmount: itemTax,
        total: itemTotal,
      };
    });

    const orderDiscount = Number(data.discount ?? 0);
    const preOrderDiscountTotal = money(subtotal + taxAmount - itemDiscountTotal);
    if (!Number.isFinite(orderDiscount) || orderDiscount < 0 || orderDiscount > preOrderDiscountTotal) {
      throw new BadRequestException('Order discount must be non-negative and cannot exceed the remaining order total');
    }
    const total = money(preOrderDiscountTotal - orderDiscount);
    const orderNumber = await this.generateOrderNumber(tenantId);

    return this.prisma.order.create({
      data: {
        tenantId,
        outletId,
        orderNumber,
        customerId: data.customerId,
        salesRepId: userId,
        source: 'ERP',
        subtotal,
        taxAmount,
        discount: orderDiscount,
        total,
        balanceDue: total,
        notes: typeof data.notes === 'string' ? data.notes.slice(0, 2000) : undefined,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
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
    const allowedStatuses = new Set([
      'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PROCESSING',
      'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED',
    ]);
    if (!allowedStatuses.has(status)) {
      throw new BadRequestException('Invalid order status');
    }
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
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) {
      throw new BadRequestException('Payment amount must be positive and have no more than two decimal places');
    }
    const allowedMethods = new Set([
      'CASH', 'CARD', 'CHEQUE', 'BANK_TRANSFER', 'CREDIT', 'MOBILE_MONEY',
    ]);
    if (typeof data.method !== 'string' || !allowedMethods.has(data.method)) {
      throw new BadRequestException('Invalid payment method');
    }
    if (typeof data.createdBy !== 'string' || !data.createdBy) {
      throw new BadRequestException('Payment actor is required');
    }

    // Apply the balance check and increment in one database transaction. A
    // read-then-write flow can over-collect when two requests arrive together.
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: {
          id,
          tenantId,
          balanceDue: { gte: amount },
        },
        data: {
          paidAmount: { increment: amount },
          balanceDue: { decrement: amount },
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException('Order not found for this company or payment exceeds the outstanding balance');
      }

      return tx.payment.create({
        data: {
          orderId: id,
          amount,
          method: data.method,
          reference: typeof data.reference === 'string' ? data.reference.slice(0, 200) : undefined,
          notes: typeof data.notes === 'string' ? data.notes.slice(0, 1000) : undefined,
          createdBy: data.createdBy,
        },
      });
    });
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
