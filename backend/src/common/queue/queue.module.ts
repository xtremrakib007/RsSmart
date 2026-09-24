import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SyncQueueService } from './sync-queue.service';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    BullModule.registerQueue({
      name: 'sync-events',
    }),
    BullModule.registerQueue({
      name: 'whatsapp',
    }),
  ],
  providers: [SyncQueueService],
  exports: [SyncQueueService, BullModule],
})
export class QueueModule {}
