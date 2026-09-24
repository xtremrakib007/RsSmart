import { SyncEventProcessor } from './sync-event.processor';

describe('SyncEventProcessor — Idempotency (Phase 25)', () => {
  let processor: SyncEventProcessor;
  let prisma: any;
  let conflictResolver: any;
  let notifications: any;
  let push: any;

  beforeEach(() => {
    prisma = {
      syncEvent: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      customer: { create: jest.fn(), update: jest.fn() },
      customerVisit: { create: jest.fn() },
    };
    conflictResolver = { checkConflict: jest.fn(), resolve: jest.fn() };
    notifications = { notifyTenant: jest.fn() };
    push = { sendToDevice: jest.fn().mockResolvedValue(undefined) };

    processor = new SyncEventProcessor(prisma, conflictResolver, notifications, push);
    (processor as any).logger = { log: jest.fn(), error: jest.fn() };
  });

  it('should skip creating order when clientTransactionId already exists', async () => {
    const existingOrder = { id: 'order-1', orderNumber: 'SO-001' };
    prisma.order.findUnique.mockResolvedValue(existingOrder);

    const event = {
      id: 'event-1',
      tenantId: 'tenant-1',
      clientId: 'device-1',
      entityType: 'order',
      action: 'CREATE',
      payload: { clientTransactionId: 'txn-789', items: [] },
      status: 'PENDING',
    };

    prisma.syncEvent.findUnique.mockResolvedValue(event);
    conflictResolver.checkConflict.mockResolvedValue({ hasConflict: false });

    const result = await (processor as any).process({ data: { eventId: 'event-1' }, attemptsMade: 0 } as any);

    expect(prisma.order.create).not.toHaveBeenCalled();
    expect(result.status).toBe('completed');
  });

  it('should create order when clientTransactionId is new', async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    prisma.order.create.mockResolvedValue({ id: 'order-new' });

    const event = {
      id: 'event-2',
      tenantId: 'tenant-1',
      clientId: 'device-1',
      entityType: 'order',
      action: 'CREATE',
      payload: { clientTransactionId: 'txn-new', items: [] },
      status: 'PENDING',
    };

    prisma.syncEvent.findUnique.mockResolvedValue(event);
    conflictResolver.checkConflict.mockResolvedValue({ hasConflict: false });

    const result = await (processor as any).process({ data: { eventId: 'event-2' }, attemptsMade: 0 } as any);

    expect(prisma.order.create).toHaveBeenCalled();
    expect(result.status).toBe('completed');
  });
});
