import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

function parseDateRange(fromValue: string, toValue: string) {
  if (typeof fromValue !== 'string' || typeof toValue !== 'string' || !fromValue.trim() || !toValue.trim()) {
    throw new BadRequestException('fromDate and toDate are required');
  }

  const fromDate = new Date(fromValue);
  const toDate = new Date(toValue);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new BadRequestException('fromDate and toDate must be valid dates');
  }
  if (fromDate > toDate) {
    throw new BadRequestException('fromDate must be before or equal to toDate');
  }

  return { gte: fromDate, lte: toDate };
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async salesReport(tenantId: string, filters: { fromDate: string; toDate: string; salesRepId?: string; customerId?: string }) {
    const where: any = {
      tenantId,
      createdAt: parseDateRange(filters.fromDate, filters.toDate),
    };
    if (filters.salesRepId) where.salesRepId = filters.salesRepId;
    if (filters.customerId) where.customerId = filters.customerId;

    const orders = await this.prisma.order.findMany({
      where,
      include: { items: true, payments: { select: { id: true, amount: true, method: true, createdAt: true } }, customer: { select: { id: true, name: true, category: true } }, salesRep: { select: { id: true, firstName: true, lastName: true } } },
    });

    // Returned POS orders remain visible for audit, but must not inflate sales
    // revenue. Keep grossRevenue for reconciliation and expose totalRevenue as
    // revenue from orders that have not been returned.
    const grossRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const saleOrders = orders.filter((o) => o.status !== 'RETURNED');
    const netSalesRevenue = saleOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const summary = {
      totalOrders: orders.length,
      grossRevenue,
      totalRevenue: netSalesRevenue,
      totalTax: saleOrders.reduce((sum, o) => sum + Number(o.taxAmount), 0),
      totalDiscount: saleOrders.reduce((sum, o) => sum + Number(o.discount), 0),
      averageOrderValue: saleOrders.length > 0 ? netSalesRevenue / saleOrders.length : 0,
      paidAmount: orders.reduce((sum, o) => sum + Number(o.paidAmount), 0),
      outstanding: orders.reduce((sum, o) => sum + Number(o.balanceDue), 0),
    };

    const byStatus = {};
    const byPaymentMethod = {};
    const dailyBreakdown = {};

    for (const order of orders) {
      byStatus[order.status] = (byStatus[order.status] || 0) + Number(order.total);

      for (const payment of order.payments) {
        byPaymentMethod[payment.method] = (byPaymentMethod[payment.method] || 0) + Number(payment.amount);
      }

      const dateKey = order.createdAt.toISOString().split('T')[0];
      if (!dailyBreakdown[dateKey]) {
        dailyBreakdown[dateKey] = { orders: 0, revenue: 0 };
      }
      dailyBreakdown[dateKey].orders += 1;
      if (order.status !== 'RETURNED') dailyBreakdown[dateKey].revenue += Number(order.total);
    }

    return { summary, byStatus, byPaymentMethod, dailyBreakdown, orders };
  }

  async inventoryReport(tenantId: string) {
    const inventory = await this.prisma.inventory.findMany({
      where: { tenantId },
      include: { product: { select: { id: true, name: true, sku: true, categoryId: true, costPrice: true, basePrice: true, minStock: true } } },
    });

    const totalValue = inventory.reduce((sum, inv) => {
      const cost = inv.product.costPrice ? Number(inv.product.costPrice) : Number(inv.product.basePrice);
      return sum + (cost * Number(inv.quantity));
    }, 0);

    const lowStock = inventory.filter((inv) => {
      const min = inv.product.minStock ? Number(inv.product.minStock) : 0;
      return Number(inv.quantity) <= min;
    });

    const categoryBreakdown = {};
    for (const inv of inventory) {
      const cat = inv.product.categoryId || 'Uncategorized';
      if (!categoryBreakdown[cat]) categoryBreakdown[cat] = { count: 0, value: 0 };
      categoryBreakdown[cat].count += Number(inv.quantity);
      const cost = inv.product.costPrice ? Number(inv.product.costPrice) : Number(inv.product.basePrice);
      categoryBreakdown[cat].value += cost * Number(inv.quantity);
    }

    return { summary: { totalItems: inventory.length, totalValue, lowStockCount: lowStock.length }, lowStock, categoryBreakdown, inventory };
  }

  async collectionReport(tenantId: string, filters: { fromDate: string; toDate: string; salesRepId?: string }) {
    const where: any = {
      order: { tenantId },
      createdAt: parseDateRange(filters.fromDate, filters.toDate),
    };

    const payments = await this.prisma.payment.findMany({
      where,
      include: { order: { select: { id: true, orderNumber: true, customer: { select: { id: true, name: true } }, salesRep: { select: { id: true, firstName: true, lastName: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    const summary = {
      totalPayments: payments.length,
      totalAmount: payments.reduce((sum, p) => sum + Number(p.amount), 0),
      byMethod: {},
      bySalesRep: {},
    };

    for (const payment of payments) {
      summary.byMethod[payment.method] = (summary.byMethod[payment.method] || 0) + Number(payment.amount);
      const repName = `${payment.order.salesRep.firstName} ${payment.order.salesRep.lastName}`;
      summary.bySalesRep[repName] = (summary.bySalesRep[repName] || 0) + Number(payment.amount);
    }

    return { summary, payments };
  }

  async customerReport(tenantId: string) {
    const customers = await this.prisma.customer.findMany({
      where: { tenantId, isActive: true },
      include: { orders: { where: { tenantId }, select: { total: true, paidAmount: true, balanceDue: true, createdAt: true, status: true }, orderBy: { createdAt: 'desc' } } },
    });

    const report = customers.map((customer) => {
      const saleOrders = customer.orders.filter((order) => order.status !== 'RETURNED');
      const totalOrders = saleOrders.length;
      const totalRevenue = saleOrders.reduce((sum, o) => sum + Number(o.total), 0);
      const totalPaid = saleOrders.reduce((sum, o) => sum + Number(o.paidAmount), 0);
      const balance = saleOrders.reduce((sum, o) => sum + Number(o.balanceDue), 0);
      const lastOrder = customer.orders[0]?.createdAt || null;

      return {
        customer: { id: customer.id, name: customer.name, category: customer.category },
        totalOrders,
        totalRevenue,
        totalPaid,
        balance,
        lastOrder,
      };
    });

    return { summary: { totalCustomers: customers.length, totalOutstanding: report.reduce((s, r) => s + r.balance, 0) }, report };
  }
}
