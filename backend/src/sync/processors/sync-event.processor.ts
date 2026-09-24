import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConflictResolutionService } from '../conflict-resolution.service';
import { NotificationsGateway } from '../../websocket/notifications.gateway';
import { PushService } from '../../push/push.service';

@Processor('sync-events')
export class SyncEventProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncEventProcessor.name);

  constructor(
    private prisma: PrismaService,
    private conflictResolver: ConflictResolutionService,
    private notifications: NotificationsGateway,
    private push: PushService,
  ) {
    super();
  }

  async process(job: Job<{ eventId: string }>): Promise<any> {
    const { eventId } = job.data;
    this.logger.log(`Processing sync event: ${eventId} (Attempt ${job.attemptsMade + 1})`);

    const event = await this.prisma.syncEvent.findUnique({
      where: { id: eventId },
      include: { tenant: true },
    });

    if (!event) {
      throw new Error(`Sync event ${eventId} not found`);
    }

    if (event.status === 'COMPLETED') {
      this.logger.log(`Event ${eventId} already processed`);
      return { status: 'already_processed' };
    }

    // Phase 27: a retried event may have status FAILED or CONFLICT.
    // Clear the error so a fresh attempt starts clean.
    if (event.status === 'FAILED' || event.status === 'CONFLICT') {
      await this.prisma.syncEvent.update({
        where: { id: eventId },
        data: { status: 'PROCESSING', error: null },
      });
    }

    try {
      // Mark as processing
      await this.prisma.syncEvent.update({
        where: { id: eventId },
        data: { status: 'PROCESSING' },
      });

      // Check for conflicts
      const conflictCheck = await this.conflictResolver.checkConflict(event);

      if (conflictCheck.hasConflict) {
        const resolution = await this.conflictResolver.resolve(event, conflictCheck);

        if (resolution.strategy === 'manual_review') {
          await this.prisma.syncEvent.update({
            where: { id: eventId },
            data: { status: 'CONFLICT', error: JSON.stringify(conflictCheck) },
          });

          this.notifications.notifyTenant(event.tenantId, 'sync:conflict', {
            eventId: event.id,
            entityType: event.entityType,
            entityId: event.entityId,
            clientId: event.clientId,
            conflictDetails: conflictCheck,
          });

          // Targeted push to the device that raised the conflict — the
          // websocket broadcast above only reaches clients with an open
          // connection; this reaches the rep's phone even if the app is
          // backgrounded. event.clientId is the device identifier, matching
          // DeviceToken.deviceId (there's no userId on SyncEvent).
          this.push
            .sendToDevice(event.tenantId, event.clientId, {
              title: 'Sync Issue Detected',
              body: 'A sync conflict needs your attention',
              data: { type: 'SYNC_CONFLICT', screen: 'sync-resolve', eventId: event.id },
            })
            .catch(() => {
              // PushService already logs; swallow so it never fails the job.
            });

          return { status: 'conflict', requiresManualReview: true };
        }
      }

      // Apply the event
      const result = await this.applyEvent(event);

      // Mark as completed
      await this.prisma.syncEvent.update({
        where: { id: eventId },
        data: { status: 'COMPLETED', processedAt: new Date() },
      });

      // Notify clients
      this.notifications.notifyTenant(event.tenantId, 'sync:completed', {
        eventId: event.id,
        entityType: event.entityType,
        entityId: event.entityId,
        action: event.action,
      });

      return { status: 'completed', result };
    } catch (error) {
      this.logger.error(`Failed to process event ${eventId}: ${error.message}`);

      const errorMessage = error.message;
      const shouldRetry = job.attemptsMade < 4;

      if (!shouldRetry) {
        await this.prisma.syncEvent.update({
          where: { id: eventId },
          data: { status: 'FAILED', error: errorMessage },
        });

        this.notifications.notifyTenant(event.tenantId, 'sync:failed', {
          eventId: event.id,
          error: errorMessage,
          attempts: job.attemptsMade + 1,
        });
      }

      throw error; // BullMQ will retry based on config
    }
  }

  private async applyEvent(event: any) {
    const { entityType, action, payload, tenantId } = event;

    switch (entityType) {
      case 'order':
        return this.applyOrderEvent(action, payload, tenantId);
      case 'customer':
        return this.applyCustomerEvent(action, payload);
      case 'customer_visit':
        return this.applyVisitEvent(action, payload);
      case 'expense':
        return this.applyExpenseEvent(action, payload);
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  private async applyOrderEvent(action: string, payload: any, tenantId: string) {
    if (action === 'CREATE') {
      // Phase 25: idempotency — an offline sale retried through sync must
      // not create a duplicate order even if the SyncEvent row is new.
      if (payload.clientTransactionId) {
        const existing = await this.prisma.order.findUnique({
          where: {
            tenantId_clientTransactionId: {
              tenantId,
              clientTransactionId: payload.clientTransactionId,
            },
          },
        });
        if (existing) {
          this.logger.log(
            `Duplicate sync order creation skipped for clientTransactionId ${payload.clientTransactionId}`,
          );
          return existing;
        }
      }

      return this.prisma.order.create({
        data: {
          ...payload,
          status: 'PENDING_APPROVAL',
          source: 'SALES_APP',
        },
        include: { items: true, customer: true },
      });
    }
    if (action === 'UPDATE') {
      return this.prisma.order.update({
        where: { id: payload.id },
        data: payload,
      });
    }
    throw new Error(`Unsupported order action: ${action}`);
  }

  private async applyCustomerEvent(action: string, payload: any) {
    if (action === 'CREATE') {
      return this.prisma.customer.create({ data: payload });
    }
    if (action === 'UPDATE') {
      return this.prisma.customer.update({
        where: { id: payload.id },
        data: payload,
      });
    }
    throw new Error(`Unsupported customer action: ${action}`);
  }

  private async applyVisitEvent(action: string, payload: any) {
    if (action === 'CREATE') {
      return this.prisma.customerVisit.create({ data: payload });
    }
    throw new Error(`Unsupported visit action: ${action}`);
  }

  private async applyExpenseEvent(action: string, payload: any) {
    // Expense table would need to be added to schema
    this.logger.log(`Expense event recorded: ${payload.id}`);
    return { id: payload.id, recorded: true };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed for event ${job.data.eventId}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }
}
