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

describe('SyncEventProcessor — tenant scoping', () => {
  let processor: SyncEventProcessor;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      syncEvent: { findUnique: jest.fn(), update: jest.fn() },
      order: { findUnique: jest.fn(), create: jest.fn(), updateMany: jest.fn(), findFirst: jest.fn() },
      customer: { create: jest.fn().mockResolvedValue({ id: 'c1' }), updateMany: jest.fn(), findFirst: jest.fn() },
      customerVisit: { create: jest.fn() },
    };
    const conflictResolver = { checkConflict: jest.fn().mockResolvedValue({ hasConflict: false }), resolve: jest.fn() };
    processor = new SyncEventProcessor(prisma, conflictResolver as any, { notifyTenant: jest.fn() } as any, { sendToDevice: jest.fn() } as any);
    (processor as any).logger = { log: jest.fn(), error: jest.fn() };
  });

  const run = (event: any) => {
    prisma.syncEvent.findUnique.mockResolvedValue({ id: 'e1', clientId: 'd1', status: 'PENDING', ...event });
    return (processor as any).process({ data: { eventId: 'e1' }, attemptsMade: 0 } as any);
  };

  it('a device cannot create a record in another tenant', async () => {
    await run({ tenantId: 'tenant-1', entityType: 'customer', action: 'CREATE', payload: { name: 'X', tenantId: 'tenant-2' } });
    expect(prisma.customer.create).toHaveBeenCalledWith({ data: { name: 'X', tenantId: 'tenant-1' } });
  });

  it('a device can only update records of its own tenant', async () => {
    prisma.customer.updateMany.mockResolvedValue({ count: 0 });
    await expect(run({ tenantId: 'tenant-1', entityType: 'customer', action: 'UPDATE', payload: { id: 'c-other', name: 'Y', tenantId: 'tenant-2' } }))
      .rejects.toThrow(/not found/);
    expect(prisma.customer.updateMany).toHaveBeenCalledWith({ where: { id: 'c-other', tenantId: 'tenant-1' }, data: { name: 'Y' } });
  });
});
