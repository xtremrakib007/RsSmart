import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncEventProcessor } from './processors/sync-event.processor';
import { ConflictResolutionService } from './conflict-resolution.service';
import { SyncHealthService } from './health/sync-health.service';
import { SyncHealthController } from './health/sync-health.controller';
import { WebsocketModule } from '../websocket/websocket.module';
import { QueueModule } from '../common/queue/queue.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'sync-events',
    }),
    PushModule,
    QueueModule,
    WebsocketModule,
  ],
  controllers: [SyncController, SyncHealthController],
  providers: [
    SyncService,
    SyncEventProcessor,
    ConflictResolutionService,
    SyncHealthService,
  ],
  exports: [SyncService, ConflictResolutionService],
})
export class SyncModule {}
