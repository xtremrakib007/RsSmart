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
