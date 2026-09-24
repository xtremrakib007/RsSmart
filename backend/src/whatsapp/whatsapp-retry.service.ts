import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

// Sandbox-typing workaround — same reason as other services:
// no live Prisma client generated in this sandbox.
type WhatsAppMessageStatus = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'PERMANENTLY_FAILED';

/**
 * Retry policy: exponential backoff with jitter.
 *   retry 1 → ~30s
 *   retry 2 → ~60s
 *   retry 3 → ~2min
 *   retry 4 → ~4min
 *   retry 5 → ~8min
 * Max 5 retries before marking PERMANENTLY_FAILED.
 */
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 30_000; // 30 seconds

function calculateBackoff(retryCount: number): number {
  const exponential = BASE_DELAY_MS * Math.pow(2, retryCount - 1);
  const jitter = Math.random() * 0.3 * exponential; // ±30% jitter
  return Math.round(exponential + jitter);
}

/**
 * Phase 30 — WhatsApp Retry & Failure Handling.
 *
 * When a WhatsApp provider API call fails (network error, rate limit,
 * temporary Meta outage), this service:
 *   1. Records the failure on the message row (status=FAILED, retryCount++,
 *      failureReason, failedAt).
 *   2. Schedules a delayed BullMQ job to attempt the retry.
 *   3. After MAX_RETRIES, marks PERMANENTLY_FAILED and audit-logs so
 *      ops/support can investigate.
 *
 * The retry processor (whatsapp-retry.processor.ts) is the only thing that
 * calls processRetry() — never the controller or service directly.
 */
@Injectable()
export class WhatsAppRetryService {
  private readonly logger = new Logger(WhatsAppRetryService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    @InjectQueue('whatsapp-retry') private retryQueue: Queue,
  ) {}

  /**
   * Called by WhatsAppService when a provider send throws. Records the
   * failure and schedules a retry job if under the max retry limit.
   */
  async handleSendFailure(messageId: string, error: Error) {
    const message = await this.prisma.whatsAppMessage.findUnique({
      where: { id: messageId },
    });
    if (!message) {
      this.logger.warn(`handleSendFailure called for unknown message ${messageId}`);
      return;
    }

    const retryCount = (message as any).retryCount + 1;
    const failureReason = error.message || 'Unknown error';

    if (retryCount > MAX_RETRIES) {
      await this.prisma.whatsAppMessage.update({
        where: { id: messageId },
        data: {
          status: 'PERMANENTLY_FAILED' as WhatsAppMessageStatus,
          retryCount,
          failedAt: new Date(),
          failureReason,
          nextRetryAt: null,
        },
      });
      await this.audit.log({
        tenantId: (message as any).tenantId,
        userId: undefined,
        action: 'WHATSAPP_MESSAGE_PERMANENTLY_FAILED',
        entityType: 'WhatsAppMessage',
        entityId: messageId,
        newValues: { retryCount, failureReason, maxRetries: MAX_RETRIES },
      });
      this.logger.error(
        `WhatsApp message ${messageId} permanently failed after ${MAX_RETRIES} retries: ${failureReason}`,
      );
      return;
    }

    const delayMs = calculateBackoff(retryCount);
    const nextRetryAt = new Date(Date.now() + delayMs);

    await this.prisma.whatsAppMessage.update({
      where: { id: messageId },
      data: {
        status: 'FAILED' as WhatsAppMessageStatus,
        retryCount,
        failedAt: new Date(),
        failureReason,
        nextRetryAt,
      },
    });

    await this.retryQueue.add(
      'retry-message',
      { messageId },
      { delay: delayMs, attempts: 1, backoff: { type: 'fixed', delay: 0 } },
    );

    this.logger.log(
      `Scheduled retry ${retryCount}/${MAX_RETRIES} for message ${messageId} in ${delayMs}ms`,
    );
  }

  /**
   * Called ONLY by the BullMQ retry processor. Re-attempts sending a
   * failed message through the original provider.
   *
   * Returns { requeued: true } if the retry itself failed and was
   * re-scheduled; { success: true } if the send succeeded.
   */
  async processRetry(messageId: string, sendFn: (message: any) => Promise<void>) {
    const message = await this.prisma.whatsAppMessage.findUnique({
      where: { id: messageId },
      include: { account: true },
    });
    if (!message) throw new NotFoundException(`Message ${messageId} not found`);

    // Guard: don't retry messages that have already been handled
    if ((message as any).status === 'PERMANENTLY_FAILED') {
      this.logger.warn(`Skipping retry for permanently failed message ${messageId}`);
      return { skipped: true, reason: 'permanently_failed' };
    }
    if ((message as any).status === 'SENT' || (message as any).status === 'DELIVERED' || (message as any).status === 'READ') {
      this.logger.warn(`Skipping retry for already-successful message ${messageId}`);
      return { skipped: true, reason: 'already_successful' };
    }

    try {
      await sendFn(message);

      await this.prisma.whatsAppMessage.update({
        where: { id: messageId },
        data: {
          status: 'SENT' as WhatsAppMessageStatus,
          failedAt: null,
          failureReason: null,
          nextRetryAt: null,
        },
      });

      this.logger.log(`Retry succeeded for message ${messageId}`);
      return { success: true };
    } catch (error: any) {
      // The send failed again — let handleSendFailure re-schedule if under limit
      await this.handleSendFailure(messageId, error);
      return { requeued: true, error: error.message };
    }
  }

  /**
   * Admin/ops endpoint support: list messages that are stuck in FAILED or
   * PERMANENTLY_FAILED for a tenant.
   */
  async listFailedMessages(tenantId: string, limit = 50) {
    return this.prisma.whatsAppMessage.findMany({
      where: {
        tenantId,
        status: { in: ['FAILED', 'PERMANENTLY_FAILED'] },
      },
      orderBy: { failedAt: 'desc' },
      take: limit,
      include: { account: { select: { displayName: true, phoneNumber: true } }, conversation: { select: { contact: { select: { phoneNumber: true } } } } },
    });
  }
}
