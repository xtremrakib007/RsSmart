import { SyncService, PushEventResult } from './sync.service';

describe('SyncService — Offline Sync Hardening (Phase 27)', () => {
  let service: SyncService;
  let prisma: any;
  let queueService: any;

  const tenantId = 'tenant-1';
  const clientId = 'device-1';

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((fn: any) => fn(prisma)),
      syncEvent: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      syncAck: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        count: jest.fn(),
      },
      customer: { findFirst: jest.fn() },
      order: { findFirst: jest.fn() },
    };
    queueService = { addSyncEvent: jest.fn() };

    service = new SyncService(prisma, queueService);
  });

  describe('pushEvents', () => {
    it('should return per-event results with created status', async () => {
      prisma.syncEvent.findUnique.mockResolvedValue(null);
      prisma.syncEvent.create.mockResolvedValue({ id: 'event-1' });

      const events = [
        { entityType: 'customer', action: 'CREATE', entityId: 'c1', payload: { name: 'A' } },
      ];

      const results = await service.pushEvents(tenantId, clientId, events);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ eventIndex: 0, eventId: 'event-1', status: 'created' });
      expect(queueService.addSyncEvent).toHaveBeenCalledWith('event-1', 5);
    });

    it('should return duplicate status when idempotencyKey matches', async () => {
      prisma.syncEvent.findUnique.mockResolvedValue({ id: 'event-dup' });

      const events = [
        { entityType: 'order', action: 'CREATE', entityId: 'o1', payload: { clientTransactionId: 'txn-123' } },
      ];

      const results = await service.pushEvents(tenantId, clientId, events);

      expect(results[0]).toMatchObject({ eventIndex: 0, eventId: 'event-dup', status: 'duplicate' });
      expect(queueService.addSyncEvent).not.toHaveBeenCalled();
    });

    it('should return error status for individual event failures without breaking the batch', async () => {
      prisma.syncEvent.findUnique.mockResolvedValue(null);
      prisma.syncEvent.create
        .mockResolvedValueOnce({ id: 'event-ok' })
        .mockRejectedValueOnce(new Error('DB timeout'));

      const events = [
        { entityType: 'customer', action: 'CREATE', entityId: 'c1', payload: {} },
        { entityType: 'customer', action: 'CREATE', entityId: 'c2', payload: {} },
      ];

      const results = await service.pushEvents(tenantId, clientId, events);

      expect(results[0].status).toBe('created');
      expect(results[1].status).toBe('error');
      expect(results[1].error).toBe('DB timeout');
    });
  });

  describe('pullEvents', () => {
    it('should not return events the device has already acked', async () => {
      prisma.syncAck.findMany.mockResolvedValue([{ eventId: 'ev-1' }, { eventId: 'ev-2' }]);
      prisma.syncEvent.findMany.mockResolvedValue([{ id: 'ev-3' }]);

      const events = await service.pullEvents(tenantId, clientId, '2024-01-01T00:00:00Z');

      expect(prisma.syncEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { notIn: ['ev-1', 'ev-2'] },
          }),
        }),
      );
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('ev-3');
    });

    it('should return empty when all events are acked', async () => {
      prisma.syncAck.findMany.mockResolvedValue([{ eventId: 'ev-1' }]);
      prisma.syncEvent.findMany.mockResolvedValue([]);

      const events = await service.pullEvents(tenantId, clientId, '2024-01-01T00:00:00Z');

      expect(events).toEqual([]);
    });
  });

  describe('ackEvents', () => {
    it('should create ack records for received events', async () => {
      prisma.syncAck.upsert.mockResolvedValue({});

      const result = await service.ackEvents(tenantId, clientId, ['ev-1', 'ev-2']);

      expect(prisma.syncAck.upsert).toHaveBeenCalledTimes(2);
      expect(result.ackedCount).toBe(2);
    });

    it('should silently ignore duplicate acks', async () => {
      prisma.syncAck.upsert.mockResolvedValue({});

      const result = await service.ackEvents(tenantId, clientId, ['ev-1']);

      expect(result.ackedCount).toBe(1);
    });
  });

  describe('getFailedEvents', () => {
    it('should return failed events with pagination', async () => {
      prisma.syncEvent.findMany.mockResolvedValue([{ id: 'ev-fail', status: 'FAILED' }]);
      prisma.syncEvent.count.mockResolvedValue(1);

      const result = await service.getFailedEvents(tenantId, { limit: 10, offset: 0 });

      expect(result.events).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('retryEvent', () => {
    it('should requeue a failed event', async () => {
      prisma.syncEvent.findFirst.mockResolvedValue({ id: 'ev-fail', status: 'FAILED', entityType: 'order' });
      prisma.syncEvent.update.mockResolvedValue({});

      const result = await service.retryEvent(tenantId, 'ev-fail');

      expect(result.status).toBe('REQUEUED');
      expect(queueService.addSyncEvent).toHaveBeenCalledWith('ev-fail', 5);
    });

    it('should reject retrying a completed event', async () => {
      prisma.syncEvent.findFirst.mockResolvedValue({ id: 'ev-ok', status: 'COMPLETED' });

      await expect(service.retryEvent(tenantId, 'ev-ok')).rejects.toThrow('Cannot retry event with status COMPLETED');
    });
  });

  describe('getSyncStatus', () => {
    it('should include acked event count', async () => {
      prisma.syncEvent.findFirst.mockResolvedValue(null);
      prisma.syncEvent.count.mockResolvedValue(0);
      prisma.syncAck.count.mockResolvedValue(42);

      const status = await service.getSyncStatus(tenantId, clientId);

      expect(status.ackedEvents).toBe(42);
      expect(status.isHealthy).toBe(true);
    });
  });
});
