import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SyncQueueService } from '../../common/queue/sync-queue.service';

@Injectable()
export class SyncHealthService {
  constructor(
    private prisma: PrismaService,
    private queueService: SyncQueueService,
  ) {}

  async getDashboard(tenantId: string) {
    const [
      totalEvents,
      pendingEvents,
      completedEvents,
      failedEvents,
      conflictEvents,
      queueStatus,
      deviceStats,
      recentFailures,
      recentConflicts,
    ] = await Promise.all([
      this.prisma.syncEvent.count({ where: { tenantId } }),
      this.prisma.syncEvent.count({ where: { tenantId, status: 'PENDING' } }),
      this.prisma.syncEvent.count({ where: { tenantId, status: 'COMPLETED' } }),
      this.prisma.syncEvent.count({ where: { tenantId, status: 'FAILED' } }),
      this.prisma.syncEvent.count({ where: { tenantId, status: 'CONFLICT' } }),
      this.queueService.getQueueStatus(),
      this.getDeviceStats(tenantId),
      this.getRecentFailures(tenantId),
      this.getRecentConflicts(tenantId),
    ]);

    const successRate = totalEvents > 0 
      ? Math.round((completedEvents / totalEvents) * 100) 
      : 100;

    return {
      summary: {
        totalEvents,
        pendingEvents,
        completedEvents,
        failedEvents,
        conflictEvents,
        successRate,
        queueStatus,
      },
      deviceStats,
      recentFailures,
      recentConflicts,
      alerts: this.generateAlerts(pendingEvents, failedEvents, conflictEvents, queueStatus),
    };
  }

  async getDeviceStats(tenantId: string) {
    const events = await this.prisma.syncEvent.groupBy({
      by: ['clientId'],
      where: { tenantId },
      _count: { id: true },
      _max: { createdAt: true },
    });

    const deviceStats = [];
    for (const device of events) {
      const [pending, failed, lastSync] = await Promise.all([
        this.prisma.syncEvent.count({
          where: { tenantId, clientId: device.clientId, status: 'PENDING' },
        }),
        this.prisma.syncEvent.count({
          where: { tenantId, clientId: device.clientId, status: 'FAILED' },
        }),
        this.prisma.syncEvent.findFirst({
          where: { tenantId, clientId: device.clientId, status: 'COMPLETED' },
          orderBy: { processedAt: 'desc' },
          select: { processedAt: true },
        }),
      ]);

      const lastSyncAt = lastSync?.processedAt || device._max.createdAt;
      const staleMinutes = lastSyncAt 
        ? Math.floor((Date.now() - new Date(lastSyncAt).getTime()) / 60000) 
        : null;

      deviceStats.push({
        clientId: device.clientId,
        totalEvents: device._count.id,
        pendingEvents: pending,
        failedEvents: failed,
        lastSyncAt,
        staleMinutes,
        status: staleMinutes && staleMinutes > 60 ? 'STALE' : pending > 10 ? 'BACKLOG' : 'HEALTHY',
      });
    }

    return deviceStats;
  }

  async getRecentFailures(tenantId: string, limit: number = 10) {
    return this.prisma.syncEvent.findMany({
      where: { tenantId, status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        clientId: true,
        eventType: true,
        entityId: true,
        error: true,
        createdAt: true,
        attempts: true,
      },
    });
  }

  async getRecentConflicts(tenantId: string, limit: number = 10) {
    return this.prisma.syncEvent.findMany({
      where: { tenantId, status: 'CONFLICT' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        clientId: true,
        eventType: true,
        entityId: true,
        error: true,
        createdAt: true,
      },
    });
  }

  async resolveConflict(eventId: string, resolution: 'accept' | 'reject' | 'merge', mergeData?: any) {
    const event = await this.prisma.syncEvent.findUnique({ where: { id: eventId } });
    if (!event || event.status !== 'CONFLICT') {
      throw new Error('Event not found or not in conflict status');
    }

    if (resolution === 'accept') {
      // Re-process the original event
      await this.prisma.syncEvent.update({
        where: { id: eventId },
        data: { status: 'PENDING', error: null },
      });
      await this.queueService.addSyncEvent(eventId, 10); // High priority
      return { status: 'requeued', message: 'Event re-queued for processing' };
    }

    if (resolution === 'reject') {
      await this.prisma.syncEvent.update({
        where: { id: eventId },
        data: { status: 'FAILED', error: 'Manually rejected by admin' },
      });
      return { status: 'rejected', message: 'Event rejected' };
    }

    if (resolution === 'merge' && mergeData) {
      await this.prisma.syncEvent.update({
        where: { id: eventId },
        data: { status: 'PENDING', payload: mergeData, error: null },
      });
      await this.queueService.addSyncEvent(eventId, 10);
      return { status: 'merged', message: 'Merged data re-queued for processing' };
    }

    throw new Error('Invalid resolution');
  }

  async retryFailedEvents(tenantId: string, clientId?: string) {
    const where: any = { tenantId, status: 'FAILED' };
    if (clientId) where.clientId = clientId;

    const failedEvents = await this.prisma.syncEvent.findMany({
      where,
      select: { id: true },
    });

    for (const event of failedEvents) {
      await this.prisma.syncEvent.update({
        where: { id: event.id },
        data: { status: 'PENDING', error: null },
      });
      await this.queueService.addSyncEvent(event.id);
    }

    return { retried: failedEvents.length };
  }

  private generateAlerts(pending: number, failed: number, conflicts: number, queueStatus: any) {
    const alerts = [];

    if (pending > 100) {
      alerts.push({ level: 'warning', message: `High pending queue: ${pending} events` });
    }
    if (failed > 10) {
      alerts.push({ level: 'error', message: `${failed} failed events require attention` });
    }
    if (conflicts > 5) {
      alerts.push({ level: 'warning', message: `${conflicts} unresolved conflicts` });
    }
    if (queueStatus.waiting > 50) {
      alerts.push({ level: 'warning', message: `BullMQ queue backlog: ${queueStatus.waiting} jobs` });
    }
    if (queueStatus.failed > 0) {
      alerts.push({ level: 'error', message: `${queueStatus.failed} failed queue jobs` });
    }

    return alerts;
  }
}
