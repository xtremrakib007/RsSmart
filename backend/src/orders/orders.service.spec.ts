import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../push/push.service';

describe('OrdersService.updateStatus', () => {
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
    prisma = { order: { update: jest.fn().mockResolvedValue(updatedOrder) } };
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
      await service.updateStatus('order-1', 'tenant-1', status);

      expect(notifications.sendOrderConfirmationIfApplicable).not.toHaveBeenCalled();
      expect(push.sendToUser).not.toHaveBeenCalled();
    },
  );
});
