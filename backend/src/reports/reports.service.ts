import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async salesReport(tenantId: string, filters: { fromDate: string; toDate: string; salesRepId?: string; customerId?: string }) {
    const where: any = {
      tenantId,
      createdAt: {
        gte: new Date(filters.fromDate),
        lte: new Date(filters.toDate),
      },
    };
    if (filters.salesRepId) where.salesRepId = filters.salesRepId;
    if (filters.customerId) where.customerId = filters.customerId;

    const orders = await this.prisma.order.findMany({
      where,
      include: { items: true, payments: true, customer: true, salesRep: { omit: { password: true } } },
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
      include: { product: true },
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
      createdAt: {
        gte: new Date(filters.fromDate),
        lte: new Date(filters.toDate),
      },
    };

    const payments = await this.prisma.payment.findMany({
      where,
      include: { order: { include: { customer: true, salesRep: { omit: { password: true } } } } },
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
      include: { orders: { include: { payments: true } } },
    });

    const report = customers.map((customer) => {
      const totalOrders = customer.orders.length;
      const totalRevenue = customer.orders.reduce((sum, o) => sum + Number(o.total), 0);
      const totalPaid = customer.orders.reduce((sum, o) => sum + Number(o.paidAmount), 0);
      const balance = customer.orders.reduce((sum, o) => sum + Number(o.balanceDue), 0);
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
