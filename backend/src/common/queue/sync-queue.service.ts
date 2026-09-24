import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class SyncQueueService {
  constructor(@InjectQueue('sync-events') private syncQueue: Queue) {}

  async addSyncEvent(eventId: string, priority: number = 5) {
    await this.syncQueue.add(
      'process-sync-event',
      { eventId },
      {
        priority,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
  }

  async addBatchSyncEvents(eventIds: string[]) {
    const jobs = eventIds.map((eventId) => ({
      name: 'process-sync-event',
      data: { eventId },
      opts: {
        priority: 5,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
      },
    }));
    await this.syncQueue.addBulk(jobs);
  }

  async getQueueStatus() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.syncQueue.getWaitingCount(),
      this.syncQueue.getActiveCount(),
      this.syncQueue.getCompletedCount(),
      this.syncQueue.getFailedCount(),
      this.syncQueue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  async retryFailed() {
    const failedJobs = await this.syncQueue.getFailed();
    for (const job of failedJobs) {
      await job.retry();
    }
    return { retried: failedJobs.length };
  }
}
