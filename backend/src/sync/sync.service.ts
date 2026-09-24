import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { SyncQueueService } from '../common/queue/sync-queue.service';

export interface PushEventResult {
  eventIndex: number;
  eventId?: string;
  status: 'created' | 'duplicate' | 'error';
  error?: string;
}

@Injectable()
export class SyncService {
  constructor(
    private prisma: PrismaService,
    private queueService: SyncQueueService,
  ) {}

  /**
   * Push offline events from a device to the server.
   * Returns per-event results so the client knows exactly which events
   * were accepted, which were duplicates, and which failed.
   * Phase 27: wrapped in a transaction so a partial failure does not
   * leave the client in an ambiguous state.
   */
  async pushEvents(tenantId: string, clientId: string, events: any[]): Promise<PushEventResult[]> {
    const results: PushEventResult[] = [];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          // Phase 25: idempotency key prevents duplicate SyncEvent rows.
          const idempotencyKey =
            event.idempotencyKey ||
            (event.entityType === 'order' && event.action === 'CREATE'
              ? event.payload?.clientTransactionId
              : undefined);

          if (idempotencyKey) {
            const existing = await tx.syncEvent.findUnique({
              where: {
                tenantId_clientId_idempotencyKey: {
                  tenantId,
                  clientId,
                  idempotencyKey,
                },
              },
            });
            if (existing) {
              return { status: 'duplicate' as const, eventId: existing.id };
            }
          }

          const payload = event.isDelta
            ? await this.applyDeltaTx(tx, tenantId, event.entityType, event.entityId, event.payload)
            : event.payload;

          const syncEvent = await tx.syncEvent.create({
            data: {
              tenantId,
              clientId,
              idempotencyKey: idempotencyKey || undefined,
              eventType: `${event.entityType}.${event.action}`,
              entityType: event.entityType,
              entityId: event.entityId,
              action: event.action,
              payload,
              vectorClock: event.vectorClock || {},
              status: 'PENDING',
            },
          });

          return { status: 'created' as const, eventId: syncEvent.id };
        });

        if (result.status === 'created') {
          // Queue outside the transaction so a queue failure does not
          // roll back the persisted event (the event is real and needs
          // to be processed eventually).
          await this.queueService.addSyncEvent(result.eventId, this.getPriority(event));
        }

        results.push({ eventIndex: i, eventId: result.eventId, status: result.status });
      } catch (error: any) {
        results.push({ eventIndex: i, status: 'error', error: error.message });
      }
    }

    return results;
  }

  /**
   * Pull server events that this device has not yet acknowledged.
   * Phase 27: filters out events the device already acked, so a retry
   * with the same lastSyncAt never returns duplicates.
   */
  async pullEvents(
    tenantId: string,
    clientId: string,
    lastSyncAt: string,
    options?: { entities?: string[]; deltaOnly?: boolean; limit?: number },
  ) {
    const ackedEventIds = await this.prisma.syncAck.findMany({
      where: { tenantId, clientId },
      select: { eventId: true },
    });
    const ackedSet = new Set(ackedEventIds.map((a) => a.eventId));

    const where: any = {
      tenantId,
      clientId: { not: clientId },
      createdAt: { gt: new Date(lastSyncAt) },
      status: 'COMPLETED',
      id: { notIn: Array.from(ackedSet) },
    };

    if (options?.entities && options.entities.length > 0) {
      where.entityType = { in: options.entities };
    }

    const events = await this.prisma.syncEvent.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: options?.limit || 100,
    });

    if (options?.deltaOnly) {
      return this.convertToDelta(events, clientId);
    }

    return events;
  }

  /**
   * Phase 27: Acknowledge that a device has received and processed
   * events from pull. Prevents duplicates on retry.
   */
  async ackEvents(tenantId: string, clientId: string, eventIds: string[]) {
    const data = eventIds.map((eventId) => ({
      tenantId,
      clientId,
      eventId,
    }));

    // Upsert ignores duplicates gracefully
    await this.prisma.$transaction(
      data.map((d) =>
        this.prisma.syncAck.upsert({
          where: {
            tenantId_clientId_eventId: {
              tenantId: d.tenantId,
              clientId: d.clientId,
              eventId: d.eventId,
            },
          },
          update: {},
          create: d,
        }),
      ),
    );

    return { ackedCount: eventIds.length };
  }

  /**
   * Phase 27: List failed sync events for admin review.
   */
  async getFailedEvents(tenantId: string, options?: { clientId?: string; limit?: number; offset?: number }) {
    const where: any = { tenantId, status: 'FAILED' };
    if (options?.clientId) where.clientId = options.clientId;

    const [events, total] = await Promise.all([
      this.prisma.syncEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      this.prisma.syncEvent.count({ where }),
    ]);

    return { events, total };
  }

  /**
   * Phase 27: Retry a failed sync event. Admin-only.
   */
  async retryEvent(tenantId: string, eventId: string) {
    const event = await this.prisma.syncEvent.findFirst({
      where: { id: eventId, tenantId },
    });
    if (!event) throw new NotFoundException('Sync event not found');
    if (event.status !== 'FAILED' && event.status !== 'CONFLICT') {
      throw new BadRequestException(`Cannot retry event with status ${event.status}`);
    }

    await this.prisma.syncEvent.update({
      where: { id: eventId },
      data: { status: 'PENDING', error: null, processedAt: null },
    });

    await this.queueService.addSyncEvent(eventId, this.getPriority(event));
    return { eventId, status: 'REQUEUED' };
  }

  async getPendingEvents(tenantId: string) {
    return this.prisma.syncEvent.findMany({
      where: { tenantId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
  }

  async processEvent(id: string, status: 'COMPLETED' | 'FAILED' | 'CONFLICT', error?: string) {
    return this.prisma.syncEvent.update({
      where: { id },
      data: { status, processedAt: new Date(), error },
    });
  }

  async getSyncStatus(tenantId: string, clientId: string) {
    const [lastSync, pendingCount, failedCount, ackedCount] = await Promise.all([
      this.prisma.syncEvent.findFirst({
        where: { tenantId, clientId, status: 'COMPLETED' },
        orderBy: { processedAt: 'desc' },
        select: { processedAt: true },
      }),
      this.prisma.syncEvent.count({ where: { tenantId, clientId, status: 'PENDING' } }),
      this.prisma.syncEvent.count({ where: { tenantId, clientId, status: 'FAILED' } }),
      this.prisma.syncAck.count({ where: { tenantId, clientId } }),
    ]);

    return {
      clientId,
      lastSyncAt: lastSync?.processedAt || null,
      pendingEvents: pendingCount,
      failedEvents: failedCount,
      ackedEvents: ackedCount,
      isHealthy: failedCount === 0 && pendingCount < 10,
    };
  }

  private async applyDeltaTx(tx: any, tenantId: string, entityType: string, entityId: string, delta: any) {
    const current = await this.getCurrentStateTx(tx, tenantId, entityType, entityId);
    if (!current) return delta;
    return { ...current, ...delta, id: entityId };
  }

  private async getCurrentStateTx(tx: any, tenantId: string, entityType: string, entityId: string) {
    switch (entityType) {
      case 'customer':
        return tx.customer.findFirst({ where: { id: entityId, tenantId } });
      case 'order':
        return tx.order.findFirst({ where: { id: entityId, tenantId } });
      default:
        return null;
    }
  }

  private convertToDelta(events: any[], clientId: string) {
    const entityMap = new Map();
    for (const event of events) {
      const key = `${event.entityType}:${event.entityId}`;
      if (!entityMap.has(key)) entityMap.set(key, []);
      entityMap.get(key).push(event);
    }

    const deltas = [];
    for (const [key, entityEvents] of entityMap) {
      const [entityType, entityId] = key.split(':');
      const latestEvent = entityEvents[entityEvents.length - 1];
      if (latestEvent.action === 'CREATE') {
        deltas.push(latestEvent);
      } else {
        deltas.push({
          ...latestEvent,
          payload: this.extractChangedFields(entityEvents),
          isDelta: true,
        });
      }
    }
    return deltas;
  }

  private extractChangedFields(events: any[]) {
    const changedFields: any = {};
    for (const event of events) {
      if (event.action === 'UPDATE') Object.assign(changedFields, event.payload);
    }
    return changedFields;
  }

  private getPriority(event: any): number {
    if (event.entityType === 'order' && event.action === 'CREATE') return 10;
    if (event.entityType === 'payment') return 9;
    if (event.entityType === 'customer_visit') return 3;
    return 5;
  }
}
