import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';

describe('WhatsAppService — Templates & Media (Phase 29)', () => {
  let service: WhatsAppService;
  let prisma: any;
  let mockProvider: any;
  let metaProvider: any;

  beforeEach(() => {
    prisma = {
      whatsAppAccount: { findFirst: jest.fn() },
      whatsAppTemplate: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      whatsAppContact: { upsert: jest.fn() },
      whatsAppConversation: { upsert: jest.fn() },
      whatsAppMessage: { create: jest.fn() },
      audit: { log: jest.fn() },
    };
    mockProvider = { sendTemplate: jest.fn(), sendMedia: jest.fn() };
    metaProvider = { sendTemplate: jest.fn(), sendMedia: jest.fn() };

    service = new WhatsAppService(
      prisma,
      prisma.audit,
      mockProvider,
      metaProvider,
      { create: jest.fn() } as any,
      { findMatchingRule: jest.fn() } as any,
      { encrypt: jest.fn((x) => x) } as any,
    );
  });

  describe('createTemplate', () => {
    it('should reject invalid Meta template names', async () => {
      prisma.whatsAppAccount.findFirst.mockResolvedValue({ id: 'acc-1', provider: 'META_CLOUD', tenantId: 't1' });
      await expect(
        service.createTemplate('t1', 'u1', { accountId: 'acc-1', name: 'Hello World!', body: 'Test' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a template for MOCK provider', async () => {
      prisma.whatsAppAccount.findFirst.mockResolvedValue({ id: 'acc-1', provider: 'MOCK', tenantId: 't1' });
      prisma.whatsAppTemplate.create.mockResolvedValue({ id: 'tpl-1', name: 'hello_world' });

      const result = await service.createTemplate('t1', 'u1', {
        accountId: 'acc-1',
        name: 'hello_world',
        body: 'Hello {{1}}',
        language: 'en',
      });

      expect(result.name).toBe('hello_world');
    });
  });

  describe('sendTemplateMessage', () => {
    it('should send an approved template', async () => {
      prisma.whatsAppAccount.findFirst.mockResolvedValue({
        id: 'acc-1', tenantId: 't1', provider: 'MOCK', status: 'CONNECTED',
      });
      prisma.whatsAppTemplate.findFirst.mockResolvedValue({
        id: 'tpl-1', name: 'order_confirm', language: 'en', status: 'APPROVED', body: 'Your order {{1}} is ready',
      });
      mockProvider.sendTemplate.mockResolvedValue({ providerMessageId: 'msg-123' });
      prisma.whatsAppContact.upsert.mockResolvedValue({ id: 'c1' });
      prisma.whatsAppConversation.upsert.mockResolvedValue({ id: 'conv-1' });
      prisma.whatsAppMessage.create.mockResolvedValue({ id: 'm1' });

      const result = await service.sendTemplateMessage('t1', 'u1', 'acc-1', {
        to: '+60123456789',
        templateName: 'order_confirm',
        params: { '1': '#123' },
      });

      expect(mockProvider.sendTemplate).toHaveBeenCalledWith(
        expect.anything(),
        '+60123456789',
        expect.objectContaining({ name: 'order_confirm', language: 'en', params: { '1': '#123' } }),
      );
      expect(result.type).toBe('TEMPLATE');
    });

    it('should reject unapproved templates', async () => {
      prisma.whatsAppAccount.findFirst.mockResolvedValue({
        id: 'acc-1', tenantId: 't1', provider: 'MOCK', status: 'CONNECTED',
      });
      prisma.whatsAppTemplate.findFirst.mockResolvedValue({
        id: 'tpl-1', name: 'pending_tpl', status: 'PENDING', body: 'Test',
      });

      await expect(
        service.sendTemplateMessage('t1', 'u1', 'acc-1', { to: '+60123456789', templateName: 'pending_tpl' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('sendMediaMessage', () => {
    it('should send an image message', async () => {
      prisma.whatsAppAccount.findFirst.mockResolvedValue({
        id: 'acc-1', tenantId: 't1', provider: 'MOCK', status: 'CONNECTED',
      });
      mockProvider.sendMedia.mockResolvedValue({ providerMessageId: 'msg-img-1' });
      prisma.whatsAppContact.upsert.mockResolvedValue({ id: 'c1' });
      prisma.whatsAppConversation.upsert.mockResolvedValue({ id: 'conv-1' });
      prisma.whatsAppMessage.create.mockResolvedValue({ id: 'm1' });

      const result = await service.sendMediaMessage('t1', 'u1', 'acc-1', {
        to: '+60123456789',
        type: 'image',
        url: 'https://example.com/image.jpg',
        caption: 'Check this out',
      });

      expect(mockProvider.sendMedia).toHaveBeenCalledWith(
        expect.anything(),
        '+60123456789',
        expect.objectContaining({ type: 'image', url: 'https://example.com/image.jpg', caption: 'Check this out' }),
      );
      expect(result.mediaUrl).toBe('https://example.com/image.jpg');
    });
  });
});
