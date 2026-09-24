import { NotFoundException } from '@nestjs/common';
import { WhatsAppRetryService } from './whatsapp-retry.service';

describe('WhatsAppRetryService', () => {
  let service: WhatsAppRetryService;
  let prisma: any;
  let audit: { log: jest.Mock };
  let queue: { add: jest.Mock };

  const messageId = 'msg-1';
  const tenantId = 'tenant-1';

  beforeEach(() => {
    prisma = {
      whatsAppMessage: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };
    audit = { log: jest.fn() };
    queue = { add: jest.fn() };

    service = new WhatsAppRetryService(prisma, audit as any, queue as any);
  });

  describe('handleSendFailure', () => {
    it('ignores unknown message ids', async () => {
      prisma.whatsAppMessage.findUnique.mockResolvedValue(null);
      await service.handleSendFailure('unknown', new Error('network'));
      expect(prisma.whatsAppMessage.update).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('marks permanently failed after 5 retries and does not requeue', async () => {
      prisma.whatsAppMessage.findUnique.mockResolvedValue({
        id: messageId,
        tenantId,
        retryCount: 5,
        status: 'FAILED',
      });
      prisma.whatsAppMessage.update.mockResolvedValue({});

      await service.handleSendFailure(messageId, new Error('rate limit'));

      expect(prisma.whatsAppMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PERMANENTLY_FAILED', retryCount: 6 }),
        }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WHATSAPP_MESSAGE_PERMANENTLY_FAILED' }),
      );
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('schedules a delayed retry when under the max retry limit', async () => {
      prisma.whatsAppMessage.findUnique.mockResolvedValue({
        id: messageId,
        tenantId,
        retryCount: 1,
        status: 'FAILED',
      });
      prisma.whatsAppMessage.update.mockResolvedValue({});

      await service.handleSendFailure(messageId, new Error('timeout'));

      expect(prisma.whatsAppMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            retryCount: 2,
            failureReason: 'timeout',
            nextRetryAt: expect.any(Date),
          }),
        }),
      );
      expect(queue.add).toHaveBeenCalledWith(
        'retry-message',
        { messageId },
        expect.objectContaining({ delay: expect.any(Number) }),
      );
    });
  });

  describe('processRetry', () => {
    it('skips permanently failed messages', async () => {
      prisma.whatsAppMessage.findUnique.mockResolvedValue({
        id: messageId,
        status: 'PERMANENTLY_FAILED',
        retryCount: 6,
      });

      const result = await service.processRetry(messageId, jest.fn());

      expect(result).toEqual({ skipped: true, reason: 'permanently_failed' });
    });

    it('skips already-successful messages', async () => {
      prisma.whatsAppMessage.findUnique.mockResolvedValue({
        id: messageId,
        status: 'DELIVERED',
        retryCount: 0,
      });

      const result = await service.processRetry(messageId, jest.fn());

      expect(result).toEqual({ skipped: true, reason: 'already_successful' });
    });

    it('calls sendFn and marks SENT on success', async () => {
      prisma.whatsAppMessage.findUnique.mockResolvedValue({
        id: messageId,
        status: 'FAILED',
        retryCount: 2,
      });
      prisma.whatsAppMessage.update.mockResolvedValue({});
      const sendFn = jest.fn().mockResolvedValue(undefined);

      const result = await service.processRetry(messageId, sendFn);

      expect(sendFn).toHaveBeenCalled();
      expect(prisma.whatsAppMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SENT', failedAt: null, failureReason: null }),
        }),
      );
      expect(result).toEqual({ success: true });
    });

    it('requeues via handleSendFailure when sendFn throws', async () => {
      prisma.whatsAppMessage.findUnique.mockResolvedValue({
        id: messageId,
        tenantId,
        status: 'FAILED',
        retryCount: 1,
      });
      prisma.whatsAppMessage.update.mockResolvedValue({});
      const sendFn = jest.fn().mockRejectedValue(new Error('still down'));

      const result = await service.processRetry(messageId, sendFn);

      expect(result).toEqual(expect.objectContaining({ requeued: true }));
      expect(prisma.whatsAppMessage.update).toHaveBeenCalledTimes(2); // once for requeue, once in handleSendFailure
    });

    it('throws NotFound for missing message', async () => {
      prisma.whatsAppMessage.findUnique.mockResolvedValue(null);
      await expect(service.processRetry('missing', jest.fn())).rejects.toThrow(NotFoundException);
    });
  });

  describe('listFailedMessages', () => {
    it('scopes to tenant and returns only FAILED / PERMANENTLY_FAILED', async () => {
      prisma.whatsAppMessage.findMany.mockResolvedValue([]);
      await service.listFailedMessages(tenantId, 20);
      expect(prisma.whatsAppMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId,
            status: { in: ['FAILED', 'PERMANENTLY_FAILED'] },
          },
          take: 20,
        }),
      );
    });
  });


describe('Phase 30 — Full retry chain verification', () => {
  let service: WhatsAppRetryService;
  let prisma: any;
  let audit: { log: jest.Mock };
  let queue: { add: jest.Mock };

  const messageId = 'msg-chain-1';
  const tenantId = 'tenant-1';

  beforeEach(() => {
    prisma = {
      whatsAppMessage: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
    };
    audit = { log: jest.fn() };
    queue = { add: jest.fn() };
    service = new WhatsAppRetryService(prisma, audit, queue);
  });

  // ── Full chain: temporary failure → retry → success ────
  it('temporary failure → retry scheduled → retry succeeds → message marked SENT', async () => {
    // Initial state: message failed once
    prisma.whatsAppMessage.findUnique
      .mockResolvedValueOnce({
        id: messageId, tenantId, status: 'FAILED', retryCount: 1,
        account: { provider: 'META_CLOUD' },
        conversation: { contact: { phoneNumber: '+60123456789' } },
        type: 'TEXT', body: 'Hello', mediaUrl: null,
      })
      .mockResolvedValueOnce({
        id: messageId, tenantId, status: 'FAILED', retryCount: 1,
        account: { provider: 'META_CLOUD' },
        conversation: { contact: { phoneNumber: '+60123456789' } },
        type: 'TEXT', body: 'Hello', mediaUrl: null,
      });

    prisma.whatsAppMessage.update.mockResolvedValue({});

    // Step 1: handleSendFailure schedules retry
    await service.handleSendFailure(messageId, new Error('timeout'));

    expect(queue.add).toHaveBeenCalledWith(
      'retry-message',
      { messageId },
      expect.objectContaining({ delay: expect.any(Number) }),
    );

    // Step 2: processRetry is called by the worker — sendFn succeeds
    const sendFn = jest.fn().mockResolvedValue(undefined);
    const result = await service.processRetry(messageId, sendFn);

    expect(result).toEqual({ success: true });
    expect(prisma.whatsAppMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SENT', failedAt: null, failureReason: null }),
      }),
    );
  });

  // ── Full chain: failure → max retries → permanent failure ─
  it('failure → retry 1 → failure → retry 2 → failure → retry 3 → failure → retry 4 → failure → retry 5 → permanent failure', async () => {
    // Simulate 5 consecutive failures, each incrementing retryCount
    for (let i = 1; i <= 5; i++) {
      prisma.whatsAppMessage.findUnique.mockResolvedValueOnce({
        id: messageId, tenantId, status: 'FAILED', retryCount: i,
      });
      prisma.whatsAppMessage.update.mockResolvedValue({});

      await service.handleSendFailure(messageId, new Error(`attempt ${i} failed`));

      if (i < 5) {
        // Under max retries: should schedule another retry
        expect(queue.add).toHaveBeenCalledWith(
          'retry-message',
          { messageId },
          expect.objectContaining({ delay: expect.any(Number) }),
        );
      } else {
        // At max retries: should NOT schedule another retry
        const lastCall = queue.add.mock.calls[queue.add.mock.calls.length - 1];
        if (lastCall && lastCall[0] === 'retry-message') {
          // This was the 4th retry scheduling; the 5th should not schedule
          expect(queue.add).toHaveBeenCalledTimes(4);
        }
      }
    }

    // After 5 retries, message should be PERMANENTLY_FAILED
    expect(prisma.whatsAppMessage.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PERMANENTLY_FAILED' }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'WHATSAPP_MESSAGE_PERMANENTLY_FAILED' }),
    );
  });

  // ── Duplicate processing ─────────────────────────────────
  it('does not re-send a message that is already SENT', async () => {
    prisma.whatsAppMessage.findUnique.mockResolvedValue({
      id: messageId, tenantId, status: 'SENT', retryCount: 2,
      account: { provider: 'META_CLOUD' },
      conversation: { contact: { phoneNumber: '+60123456789' } },
      type: 'TEXT', body: 'Hello',
    });

    const sendFn = jest.fn();
    const result = await service.processRetry(messageId, sendFn);

    expect(result).toEqual({ skipped: true, reason: 'already_successful' });
    expect(sendFn).not.toHaveBeenCalled();
    expect(prisma.whatsAppMessage.update).not.toHaveBeenCalled();
  });

  it('does not re-send a message that is already DELIVERED', async () => {
    prisma.whatsAppMessage.findUnique.mockResolvedValue({
      id: messageId, tenantId, status: 'DELIVERED', retryCount: 1,
      account: { provider: 'META_CLOUD' },
      conversation: { contact: { phoneNumber: '+60123456789' } },
      type: 'TEXT', body: 'Hello',
    });

    const sendFn = jest.fn();
    const result = await service.processRetry(messageId, sendFn);

    expect(result).toEqual({ skipped: true, reason: 'already_successful' });
    expect(sendFn).not.toHaveBeenCalled();
  });

  it('does not re-send a message that is already READ', async () => {
    prisma.whatsAppMessage.findUnique.mockResolvedValue({
      id: messageId, tenantId, status: 'READ', retryCount: 0,
      account: { provider: 'META_CLOUD' },
      conversation: { contact: { phoneNumber: '+60123456789' } },
      type: 'TEXT', body: 'Hello',
    });

    const sendFn = jest.fn();
    const result = await service.processRetry(messageId, sendFn);

    expect(result).toEqual({ skipped: true, reason: 'already_successful' });
    expect(sendFn).not.toHaveBeenCalled();
  });

  it('does not re-process a PERMANENTLY_FAILED message', async () => {
    prisma.whatsAppMessage.findUnique.mockResolvedValue({
      id: messageId, tenantId, status: 'PERMANENTLY_FAILED', retryCount: 6,
      account: { provider: 'META_CLOUD' },
      conversation: { contact: { phoneNumber: '+60123456789' } },
      type: 'TEXT', body: 'Hello',
    });

    const sendFn = jest.fn();
    const result = await service.processRetry(messageId, sendFn);

    expect(result).toEqual({ skipped: true, reason: 'permanently_failed' });
    expect(sendFn).not.toHaveBeenCalled();
  });

  // ── Retry backoff increases ──────────────────────────────
  it('schedules retries with increasing delay', async () => {
    prisma.whatsAppMessage.findUnique.mockResolvedValue({
      id: messageId, tenantId, status: 'FAILED', retryCount: 0,
    });
    prisma.whatsAppMessage.update.mockResolvedValue({});

    const delays: number[] = [];
    queue.add.mockImplementation((name: string, data: any, opts: any) => {
      delays.push(opts.delay);
      return Promise.resolve({});
    });

    // 5 failures → 4 retries scheduled (5th is permanent)
    for (let i = 1; i <= 4; i++) {
      prisma.whatsAppMessage.findUnique.mockResolvedValueOnce({
        id: messageId, tenantId, status: 'FAILED', retryCount: i - 1,
      });
      await service.handleSendFailure(messageId, new Error(`fail ${i}`));
    }

    // Each delay should be larger than the previous (exponential backoff)
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }
  });
});
});
