import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncEventProcessor } from './processors/sync-event.processor';
import { ConflictResolutionService } from './conflict-resolution.service';
import { SyncHealthService } from './health/sync-health.service';
import { SyncHealthController } from './health/sync-health.controller';
import { NotificationsGateway } from '../websocket/notifications.gateway';
import { PushModule } from '../push/push.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'sync-events',
    }),
    PushModule,
  ],
  controllers: [SyncController, SyncHealthController],
  providers: [
    SyncService,
    SyncEventProcessor,
    ConflictResolutionService,
    SyncHealthService,
    NotificationsGateway,
  ],
  exports: [SyncService, ConflictResolutionService],
})
export class SyncModule {}
