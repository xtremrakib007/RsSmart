import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../push/push.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: { order: Record<string, jest.Mock> };
  let notifications: { sendOrderConfirmationIfApplicable: jest.Mock };
  let push: { sendToUser: jest.Mock };

  const updatedOrder = {
    id: 'order-1',
    orderNumber: 'ORD-202608-00001',
    total: 100,
    source: 'ERP',
    salesRepId: 'rep-1',
    createdAt: new Date(),
    customer: { name: 'Jane Tan', email: 'jane@example.com', phone: '+60123456789' },
    items: [],
  };

  beforeEach(async () => {
    prisma = { order: { update: jest.fn().mockResolvedValue(updatedOrder), updateMany: jest.fn().mockResolvedValue({ count: 1 }), findFirst: jest.fn().mockResolvedValue(updatedOrder), findMany: jest.fn().mockResolvedValue([]) } };
    notifications = { sendOrderConfirmationIfApplicable: jest.fn().mockResolvedValue(undefined) };
    push = { sendToUser: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: PushService, useValue: push },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('triggers a customer confirmation and a push to the sales rep when status transitions to APPROVED', async () => {
    prisma.order.findFirst.mockResolvedValueOnce({ id: 'order-1', status: 'PENDING_APPROVAL' }).mockResolvedValueOnce(updatedOrder);
    await service.updateStatus('order-1', 'tenant-1', 'APPROVED', 'manager-1');

    expect(notifications.sendOrderConfirmationIfApplicable).toHaveBeenCalledWith(
      expect.objectContaining({ orderNumber: updatedOrder.orderNumber, source: 'ERP' }),
    );
    expect(push.sendToUser).toHaveBeenCalledWith(
      'tenant-1',
      'rep-1',
      expect.objectContaining({ title: 'Order Approved' }),
    );
  });

  it.each(['DRAFT', 'PENDING_APPROVAL', 'PROCESSING', 'SHIPPED', 'CANCELLED'])(
    'does not trigger a confirmation or push for %s',
    async (status) => {
      const previousStatus: Record<string, string> = {
        DRAFT: 'PENDING_APPROVAL',
        PENDING_APPROVAL: 'DRAFT',
        PROCESSING: 'APPROVED',
        SHIPPED: 'PROCESSING',
        CANCELLED: 'DRAFT',
      };
      prisma.order.findFirst.mockResolvedValueOnce({ id: 'order-1', status: previousStatus[status] }).mockResolvedValueOnce(updatedOrder);
      await service.updateStatus('order-1', 'tenant-1', status);

      expect(notifications.sendOrderConfirmationIfApplicable).not.toHaveBeenCalled();
      expect(push.sendToUser).not.toHaveBeenCalled();
    },
  );
});

describe('OrdersService.findAll security and pagination', () => {
  let service: OrdersService;
  let prisma: { order: Record<string, jest.Mock> };

  beforeEach(async () => {
    prisma = { order: { findMany: jest.fn().mockResolvedValue([]) } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: { sendOrderConfirmationIfApplicable: jest.fn() } },
        { provide: PushService, useValue: { sendToUser: jest.fn() } },
      ],
    }).compile();
    service = module.get<OrdersService>(OrdersService);
  });

  it('defaults to page 1 and 50 records and scopes the query to the tenant', async () => {
    await service.findAll('tenant-1');
    expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1' },
      skip: 0,
      take: 50,
    }));
  });

  it('scopes order listing to the outlet authorized by OutletGuard', async () => {
    await service.findAll('tenant-1', { outletId: 'outlet-authorized' });

    expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1', outletId: 'outlet-authorized' },
    }));
  });

  it('applies validated pagination and status/date filters', async () => {
    await service.findAll('tenant-1', {
      page: '3', limit: '25', status: 'APPROVED',
      fromDate: '2026-01-01T00:00:00.000Z', toDate: '2026-01-31T23:59:59.999Z',
    });
    expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        tenantId: 'tenant-1',
        status: 'APPROVED',
        createdAt: {
          gte: new Date('2026-01-01T00:00:00.000Z'),
          lte: new Date('2026-01-31T23:59:59.999Z'),
        },
      },
      skip: 50,
      take: 25,
    }));
  });

  it.each([
    [{ page: '0' }],
    [{ page: '1000001' }],
    [{ page: '1.5' }],
    [{ limit: '101' }],
    [{ limit: '0' }],
    [{ status: 'NOT_A_STATUS' }],
    [{ fromDate: 'not-a-date' }],
    [{ fromDate: '2026-02-01', toDate: '2026-01-01' }],
  ])('rejects invalid filters: %o', async (filters) => {
    await expect(service.findAll('tenant-1', filters)).rejects.toThrow();
    expect(prisma.order.findMany).not.toHaveBeenCalled();
  });
});
