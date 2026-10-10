import { ReportsService } from './reports.service';

describe('ReportsService — returned POS sales', () => {
  let service: ReportsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sale-1',
            status: 'APPROVED',
            total: 100,
            taxAmount: 10,
            discount: 5,
            paidAmount: 100,
            balanceDue: 0,
            createdAt: new Date('2026-10-10T10:00:00.000Z'),
            items: [],
            payments: [{ method: 'CASH', amount: 100 }],
            customer: { id: 'customer-1' },
            salesRep: { id: 'user-1', password: undefined },
          },
          {
            id: 'sale-2',
            status: 'RETURNED',
            total: 50,
            taxAmount: 5,
            discount: 0,
            paidAmount: 0,
            balanceDue: 0,
            createdAt: new Date('2026-10-10T11:00:00.000Z'),
            items: [],
            payments: [{ method: 'CASH', amount: -50 }],
            customer: { id: 'customer-1' },
            salesRep: { id: 'user-1', password: undefined },
          },
        ]),
      },
    };
    service = new ReportsService(prisma);
  });

  it('reports gross revenue separately and excludes returned orders from net sales revenue', async () => {
    const report = await service.salesReport('tenant-1', {
      fromDate: '2026-10-10T00:00:00.000Z',
      toDate: '2026-10-10T23:59:59.999Z',
    });

    expect(report.summary).toMatchObject({
      totalOrders: 2,
      grossRevenue: 150,
      totalRevenue: 100,
      totalTax: 10,
      totalDiscount: 5,
      averageOrderValue: 100,
      paidAmount: 100,
      outstanding: 0,
    });
    expect(report.byStatus).toMatchObject({ APPROVED: 100, RETURNED: 50 });
    expect(report.byPaymentMethod).toMatchObject({ CASH: 50 });
    expect(report.dailyBreakdown['2026-10-10']).toMatchObject({ orders: 2, revenue: 100 });
  });
});


describe('ReportsService date filter validation', () => {
  let service: ReportsService;
  let prisma: any;

  beforeEach(() => {
    prisma = { order: { findMany: jest.fn() }, payment: { findMany: jest.fn() } };
    service = new ReportsService(prisma);
  });

  it('rejects invalid sales report dates before querying the database', async () => {
    await expect(service.salesReport('tenant-1', {
      fromDate: 'not-a-date',
      toDate: '2026-10-10T23:59:59.999Z',
    })).rejects.toThrow('fromDate and toDate must be valid dates');
    expect(prisma.order.findMany).not.toHaveBeenCalled();
  });

  it('rejects inverted collection report date ranges before querying the database', async () => {
    await expect(service.collectionReport('tenant-1', {
      fromDate: '2026-10-11T00:00:00.000Z',
      toDate: '2026-10-10T00:00:00.000Z',
    })).rejects.toThrow('fromDate must be before or equal to toDate');
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });
});


describe('ReportsService data minimization and customer tenant scope', () => {
  it('selects limited related fields for sales reports', async () => {
    const prisma: any = {
      order: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new ReportsService(prisma);

    await service.salesReport('tenant-1', {
      fromDate: '2026-10-10T00:00:00.000Z',
      toDate: '2026-10-10T23:59:59.999Z',
    });

    const query = prisma.order.findMany.mock.calls[0][0];
    expect(query.where.tenantId).toBe('tenant-1');
    expect(query.include.customer.select).toEqual({ id: true, name: true, category: true });
    expect(query.include.salesRep.select).toEqual({ id: true, firstName: true, lastName: true });
    expect(query.include.payments.select).toEqual({
      id: true, amount: true, method: true, createdAt: true,
    });
  });

  it('scopes nested orders to the tenant and excludes returned orders from customer totals', async () => {
    const prisma: any = {
      customer: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'customer-1',
          name: 'Example Customer',
          category: 'Regular',
          orders: [
            { total: 100, paidAmount: 100, balanceDue: 0, status: 'APPROVED', createdAt: new Date('2026-10-10T10:00:00Z') },
            { total: 50, paidAmount: 0, balanceDue: 0, status: 'RETURNED', createdAt: new Date('2026-10-10T11:00:00Z') },
          ],
        }]),
      },
    };
    const service = new ReportsService(prisma);

    const result = await service.customerReport('tenant-1');

    const query = prisma.customer.findMany.mock.calls[0][0];
    expect(query.where.tenantId).toBe('tenant-1');
    expect(query.include.orders.where.tenantId).toBe('tenant-1');
    expect(query.include.orders.select).toEqual({
      total: true, paidAmount: true, balanceDue: true, createdAt: true, status: true,
    });
    expect(result.report[0]).toMatchObject({
      totalOrders: 1,
      totalRevenue: 100,
      totalPaid: 100,
      balance: 0,
    });
  });
});
