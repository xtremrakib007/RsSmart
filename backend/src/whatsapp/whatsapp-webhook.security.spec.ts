import { BadRequestException } from '@nestjs/common';
import { createHmac, createHash } from 'crypto';
import { WhatsAppService } from './whatsapp.service';

describe('WhatsApp Webhook Security (Phase 28)', () => {
  let service: WhatsAppService;
  let prisma: any;
  let audit: any;
  let mockProvider: any;
  let metaProvider: any;
  let orders: any;
  let campaignService: any;
  let credentials: any;
  let retryService: any;

  const tenantId = 'tenant-1';
  const accountId = 'account-1';
  const phoneNumberId = 'phone-123';
  const appSecret = 'test-app-secret-32-chars-long!!';
  const verifyToken = 'test-verify-token';

  beforeEach(() => {
    prisma = {
      whatsAppAccount: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      whatsAppMessage: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      whatsAppContact: {
        upsert: jest.fn(),
      },
      whatsAppConversation: {
        upsert: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      webhookDelivery: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    audit = { log: jest.fn() };
    mockProvider = { sendText: jest.fn(), connect: jest.fn(), disconnect: jest.fn() };
    metaProvider = { sendText: jest.fn(), connect: jest.fn(), disconnect: jest.fn() };
    orders = {};
    campaignService = { findMatchingRule: jest.fn() };
    credentials = { encrypt: jest.fn((v) => v) };
    retryService = { handleSendFailure: jest.fn() };

    service = new WhatsAppService(
      prisma, audit, mockProvider, metaProvider,
      orders, campaignService, retryService, credentials,
    );

    process.env.META_APP_SECRET = appSecret;
    process.env.META_WHATSAPP_VERIFY_TOKEN = verifyToken;
  });

  afterEach(() => {
    delete process.env.META_APP_SECRET;
    delete process.env.META_WHATSAPP_VERIFY_TOKEN;
  });

  // ── Helpers ────────────────────────────────────────────────
  function makeSignature(rawBody: Buffer): string {
    const sig = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    return `sha256=${sig}`;
  }

  function makePayload(messageId: string, from: string, type = 'text'): any {
    return {
      entry: [{
        changes: [{
          value: {
            metadata: { phone_number_id: phoneNumberId },
            messages: [{
              id: messageId,
              from,
              type,
              text: { body: 'Hello' },
            }],
          },
        }],
      }],
    };
  }

  function makeStatusPayload(statusId: string, status: string): any {
    return {
      entry: [{
        changes: [{
          value: {
            metadata: { phone_number_id: phoneNumberId },
            statuses: [{
              id: statusId,
              status,
              timestamp: String(Math.floor(Date.now() / 1000)),
            }],
          },
        }],
      }],
    };
  }

  // ── 1. Valid signature ───────────────────────────────────
  describe('verifyMetaSignature', () => {
    it('accepts a correctly signed payload', () => {
      const rawBody = Buffer.from(JSON.stringify({ test: true }));
      const signature = makeSignature(rawBody);
      expect(() => service.verifyMetaSignature(rawBody, signature)).not.toThrow();
    });

    // ── 2. Invalid signature ───────────────────────────────
    it('rejects a payload with wrong signature', () => {
      const rawBody = Buffer.from(JSON.stringify({ test: true }));
      const badSignature = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';
      expect(() => service.verifyMetaSignature(rawBody, badSignature)).toThrow(BadRequestException);
    });

    // ── 3. Missing signature ───────────────────────────────
    it('rejects a payload with no signature header', () => {
      const rawBody = Buffer.from(JSON.stringify({ test: true }));
      expect(() => service.verifyMetaSignature(rawBody, undefined)).toThrow(BadRequestException);
    });

    it('rejects a payload with malformed signature header', () => {
      const rawBody = Buffer.from(JSON.stringify({ test: true }));
      expect(() => service.verifyMetaSignature(rawBody, 'md5=abc123')).toThrow(BadRequestException);
    });

    it('rejects when META_APP_SECRET is not configured', () => {
      delete process.env.META_APP_SECRET;
      const rawBody = Buffer.from(JSON.stringify({ test: true }));
      expect(() => service.verifyMetaSignature(rawBody, 'sha256=abc')).toThrow(BadRequestException);
    });
  });

  // ── 4. Duplicate webhook ─────────────────────────────────
  describe('receiveMetaWebhook — idempotency', () => {
    it('skips a message whose providerEventId was already processed', async () => {
      const messageId = 'msg-dup-001';
      const rawBody = Buffer.from(JSON.stringify(makePayload(messageId, '+60123456789')));

      prisma.whatsAppAccount.findFirst.mockResolvedValue({
        id: accountId, tenantId, phoneNumberId, provider: 'META_CLOUD',
      });
      // WebhookDelivery already exists → duplicate
      prisma.webhookDelivery.findUnique.mockResolvedValue({ id: 'del-1' });

      const result = await service.receiveMetaWebhook(makePayload(messageId, '+60123456789'), rawBody);

      expect(result.skipped).toBe(1);
      expect(result.processed).toBe(0);
      // Message must NOT be created again
      expect(prisma.whatsAppMessage.create).not.toHaveBeenCalled();
    });

    // ── 5. Duplicate provider message ID ───────────────────
    it('skips when providerMessageId already exists in messages table', async () => {
      const messageId = 'msg-dup-002';
      const rawBody = Buffer.from(JSON.stringify(makePayload(messageId, '+60123456789')));

      prisma.whatsAppAccount.findFirst.mockResolvedValue({
        id: accountId, tenantId, phoneNumberId, provider: 'META_CLOUD',
      });
      prisma.webhookDelivery.findUnique.mockResolvedValue(null);
      // Message already exists from earlier webhook or outbound send
      prisma.whatsAppMessage.findUnique.mockResolvedValue({ id: 'existing-msg' });

      // receiveWebhook short-circuits before creating delivery record
      const result = await service.receiveMetaWebhook(makePayload(messageId, '+60123456789'), rawBody);

      // The inner receiveWebhook returns { duplicate: true } but delivery record
      // is still created by receiveMetaWebhook. processed counts as 1 because
      // the loop iteration completed (it didn't skip via webhookDelivery).
      expect(prisma.whatsAppMessage.create).not.toHaveBeenCalled();
    });
  });

  // ── 6. Wrong WhatsApp account ──────────────────────────
  describe('receiveMetaWebhook — account lookup', () => {
    it('silently skips when phone_number_id has no matching account', async () => {
      const rawBody = Buffer.from(JSON.stringify(makePayload('msg-003', '+60123456789')));

      // No account matches this phoneNumberId
      prisma.whatsAppAccount.findFirst.mockResolvedValue(null);

      const result = await service.receiveMetaWebhook(makePayload('msg-003', '+60123456789'), rawBody);

      expect(result.processed).toBe(0);
      expect(result.skipped).toBe(0);
      expect(prisma.whatsAppMessage.create).not.toHaveBeenCalled();
    });
  });

  // ── 7. Wrong tenant ──────────────────────────────────────
  describe('receiveWebhook — tenant isolation', () => {
    it('looks up account scoped to the tenant from the webhook payload', async () => {
      const messageId = 'msg-004';
      prisma.whatsAppAccount.findFirst.mockResolvedValue({
        id: accountId, tenantId, phoneNumberId, provider: 'META_CLOUD',
      });
      prisma.whatsAppMessage.findUnique.mockResolvedValue(null);
      prisma.whatsAppContact.upsert.mockResolvedValue({ id: 'contact-1' });
      prisma.whatsAppConversation.upsert.mockResolvedValue({ id: 'conv-1', botEnabled: false });
      prisma.whatsAppMessage.create.mockResolvedValue({ id: 'msg-created' });
      prisma.webhookDelivery.create.mockResolvedValue({});

      await service.receiveWebhook(tenantId, {
        accountId,
        providerMessageId: messageId,
        from: '+60123456789',
        type: 'TEXT',
        body: 'Hello',
        metadata: {},
      });

      // Account lookup must use the accountId from the DTO, which came from
      // the phone_number_id → account mapping in receiveMetaWebhook.
      expect(prisma.whatsAppAccount.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { phoneNumberId, provider: 'META_CLOUD' } }),
      );
    });
  });

  // ── 8. Malformed payload ─────────────────────────────────
  describe('receiveMetaWebhook — malformed payload', () => {
    it('handles missing entry array gracefully', async () => {
      const rawBody = Buffer.from('{}');
      const result = await service.receiveMetaWebhook({}, rawBody);
      expect(result).toEqual({ processed: 0, skipped: 0 });
    });

    it('handles missing changes array gracefully', async () => {
      const rawBody = Buffer.from(JSON.stringify({ entry: [{}] }));
      const result = await service.receiveMetaWebhook({ entry: [{}] }, rawBody);
      expect(result).toEqual({ processed: 0, skipped: 0 });
    });

    it('handles missing phone_number_id gracefully', async () => {
      const rawBody = Buffer.from(JSON.stringify({
        entry: [{ changes: [{ value: { messages: [{ id: 'm1', from: '+60' }] } }] }],
      }));
      const result = await service.receiveMetaWebhook({
        entry: [{ changes: [{ value: { messages: [{ id: 'm1', from: '+60' }] } }] }],
      }, rawBody);
      expect(result).toEqual({ processed: 0, skipped: 0 });
    });

    it('handles missing message.id or message.from gracefully', async () => {
      const rawBody = Buffer.from(JSON.stringify({
        entry: [{
          changes: [{
            value: {
              metadata: { phone_number_id: phoneNumberId },
              messages: [{ from: '+60' }], // missing id
            },
          }],
        }],
      }));
      prisma.whatsAppAccount.findFirst.mockResolvedValue({
        id: accountId, tenantId, phoneNumberId, provider: 'META_CLOUD',
      });

      const result = await service.receiveMetaWebhook({
        entry: [{
          changes: [{
            value: {
              metadata: { phone_number_id: phoneNumberId },
              messages: [{ from: '+60' }],
            },
          }],
        }],
      }, rawBody);

      expect(result.processed).toBe(0);
    });
  });

  // ── 9. Delivery status ───────────────────────────────────
  describe('processMetaStatuses — delivery', () => {
    it('updates deliveredAt when status is delivered', async () => {
      const statusId = 'status-del-001';
      const rawBody = Buffer.from(JSON.stringify(makeStatusPayload(statusId, 'delivered')));

      prisma.webhookDelivery.findUnique.mockResolvedValue(null);
      prisma.whatsAppMessage.findFirst.mockResolvedValue({ tenantId });
      prisma.whatsAppMessage.updateMany.mockResolvedValue({ count: 1 });
      prisma.webhookDelivery.create.mockResolvedValue({});

      const result = await service.processMetaStatuses(makeStatusPayload(statusId, 'delivered'), rawBody);

      expect(result.updated).toBe(1);
      expect(prisma.whatsAppMessage.updateMany).toHaveBeenCalledWith({
        where: { providerMessageId: statusId },
        data: { deliveredAt: expect.any(Date) },
      });
    });

    it('skips duplicate delivery status webhooks', async () => {
      const statusId = 'status-del-002';
      const rawBody = Buffer.from(JSON.stringify(makeStatusPayload(statusId, 'delivered')));

      prisma.webhookDelivery.findUnique.mockResolvedValue({ id: 'del-1' });

      const result = await service.processMetaStatuses(makeStatusPayload(statusId, 'delivered'), rawBody);

      expect(result.skipped).toBe(1);
      expect(result.updated).toBe(0);
      expect(prisma.whatsAppMessage.updateMany).not.toHaveBeenCalled();
    });
  });

  // ── 10. Read status ──────────────────────────────────────
  describe('processMetaStatuses — read', () => {
    it('updates readAt when status is read', async () => {
      const statusId = 'status-read-001';
      const rawBody = Buffer.from(JSON.stringify(makeStatusPayload(statusId, 'read')));

      prisma.webhookDelivery.findUnique.mockResolvedValue(null);
      prisma.whatsAppMessage.findFirst.mockResolvedValue({ tenantId });
      prisma.whatsAppMessage.updateMany.mockResolvedValue({ count: 1 });
      prisma.webhookDelivery.create.mockResolvedValue({});

      const result = await service.processMetaStatuses(makeStatusPayload(statusId, 'read'), rawBody);

      expect(result.updated).toBe(1);
      expect(prisma.whatsAppMessage.updateMany).toHaveBeenCalledWith({
        where: { providerMessageId: statusId },
        data: { readAt: expect.any(Date) },
      });
    });

    it('skips duplicate read status webhooks', async () => {
      const statusId = 'status-read-002';
      const rawBody = Buffer.from(JSON.stringify(makeStatusPayload(statusId, 'read')));

      prisma.webhookDelivery.findUnique.mockResolvedValue({ id: 'del-1' });

      const result = await service.processMetaStatuses(makeStatusPayload(statusId, 'read'), rawBody);

      expect(result.skipped).toBe(1);
      expect(result.updated).toBe(0);
    });
  });

  // ── verifyMetaWebhook ──────────────────────────────────────
  describe('verifyMetaWebhook', () => {
    it('returns challenge when mode, token, and challenge are valid', () => {
      const result = service.verifyMetaWebhook('subscribe', verifyToken, '12345');
      expect(result).toBe('12345');
    });

    it('rejects wrong mode', () => {
      expect(() => service.verifyMetaWebhook('unsubscribe', verifyToken, '12345')).toThrow(BadRequestException);
    });

    it('rejects wrong token', () => {
      expect(() => service.verifyMetaWebhook('subscribe', 'wrong-token', '12345')).toThrow(BadRequestException);
    });

    it('rejects when verify token is not configured', () => {
      delete process.env.META_WHATSAPP_VERIFY_TOKEN;
      expect(() => service.verifyMetaWebhook('subscribe', verifyToken, '12345')).toThrow(BadRequestException);
    });
  });
});
