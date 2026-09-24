import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHmac, createHash, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateWhatsAppAccountDto } from './dto/create-whatsapp-account.dto';
import { ReceiveWhatsAppWebhookDto } from './dto/receive-webhook.dto';
import { SendWhatsAppMessageDto } from './dto/send-whatsapp-message.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { AddNoteDto } from './dto/add-note.dto';
import { MockWhatsAppProvider } from './providers/mock-whatsapp.provider';
import { WhatsAppTemplateParams, WhatsAppMediaMessage } from './providers/whatsapp-provider';
import { MetaCloudWhatsAppProvider } from './providers/meta-cloud-whatsapp.provider';
import { OrdersService } from '../orders/orders.service';
import { UpdateCartDto } from './dto/update-cart.dto';
import { CheckoutCartDto } from './dto/checkout-cart.dto';
import { AssignCustomerDto } from './dto/assign-customer.dto';
import { WhatsAppCampaignService } from './whatsapp-campaign.service';
import { WhatsAppRetryService } from './whatsapp-retry.service';
import { WhatsAppCredentialService } from './security/whatsapp-credential.service';

@Injectable()
export class WhatsAppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mockProvider: MockWhatsAppProvider,
    private readonly metaProvider: MetaCloudWhatsAppProvider,
    private readonly orders: OrdersService,
    private readonly campaignService: WhatsAppCampaignService,
    private readonly credentials: WhatsAppCredentialService,
    private readonly retryService: WhatsAppRetryService,
  ) {}

  private providerFor(provider: string) { return provider === 'META_CLOUD' ? this.metaProvider : this.mockProvider; }

  listAccounts(tenantId: string) {
    return this.prisma.whatsAppAccount.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, displayName: true, phoneNumber: true, provider: true, status: true, webhookVerified: true, lastConnectedAt: true, createdAt: true },
    });
  }

  async createAccount(tenantId: string, userId: string, dto: CreateWhatsAppAccountDto) {
    if (dto.phoneNumber) {
      const duplicate = await this.prisma.whatsAppAccount.findFirst({ where: { tenantId, phoneNumber: dto.phoneNumber } });
      if (duplicate) throw new ConflictException('This WhatsApp number is already connected to this tenant');
    }

    const account = await this.prisma.whatsAppAccount.create({
      data: {
        tenantId,
        displayName: dto.displayName,
        phoneNumber: dto.phoneNumber,
        provider: dto.provider || 'MOCK',
        createdByUserId: userId,
        providerAccountId: dto.providerAccountId,
        phoneNumberId: dto.phoneNumberId,
        accessTokenEncrypted: dto.accessToken ? this.credentials.encrypt(dto.accessToken) : null,
        webhookUrl: dto.webhookUrl,
        status: 'DISCONNECTED',
      },
    });

    await this.audit.log({ tenantId, userId, action: 'WHATSAPP_ACCOUNT_CREATED', entityType: 'WhatsAppAccount', entityId: account.id, newValues: { displayName: account.displayName, phoneNumber: account.phoneNumber, provider: account.provider } });
    return account;
  }

  async connect(tenantId: string, userId: string, id: string) {
    const account = await this.getAccount(id, tenantId);
    const result = await this.providerFor(account.provider).connect(account);
    const updated = await this.prisma.whatsAppAccount.update({
      where: { id: account.id },
      data: { status: result.status, lastConnectedAt: result.status === 'CONNECTED' ? new Date() : undefined, qrCode: result.qr },
    });
    await this.audit.log({ tenantId, userId, action: 'WHATSAPP_ACCOUNT_CONNECTED', entityType: 'WhatsAppAccount', entityId: id, newValues: { status: result.status } });
    return updated;
  }

  async disconnect(tenantId: string, userId: string, id: string) {
    const account = await this.getAccount(id, tenantId);
    await this.providerFor(account.provider).disconnect(account);
    const updated = await this.prisma.whatsAppAccount.update({ where: { id }, data: { status: 'DISCONNECTED', qrCode: null } });
    await this.audit.log({ tenantId, userId, action: 'WHATSAPP_ACCOUNT_DISCONNECTED', entityType: 'WhatsAppAccount', entityId: id });
    return updated;
  }

  async receiveMetaWebhook(payload: any, rawBody: Buffer) {
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    let processed = 0;
    let skipped = 0;
    const payloadHash = createHash('sha256').update(rawBody).digest('hex');

    for (const entry of entries) for (const change of entry?.changes || []) {
      const value = change?.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const account = await this.prisma.whatsAppAccount.findFirst({
        where: { phoneNumberId, provider: 'META_CLOUD' },
      });
      if (!account) continue;

      for (const message of value?.messages || []) {
        if (!message?.id || !message?.from) continue;

        // Phase 28: idempotency — Meta may redeliver the same webhook.
        // Check WebhookDelivery before doing any work.
        const alreadyProcessed = await this.prisma.webhookDelivery.findUnique({
          where: { provider_providerEventId: { provider: 'META_CLOUD', providerEventId: message.id } },
        });
        if (alreadyProcessed) {
          skipped++;
          continue;
        }

        const type = message?.type || 'TEXT';
        let result: any;
        let httpStatus = 200;
        let error: string | null = null;

        try {
          result = await this.receiveWebhook(account.tenantId, {
            accountId: account.id,
            providerMessageId: message.id,
            from: message.from,
            type: type.toUpperCase(),
            body: type === 'text' ? message?.text?.body : `[${type}]`,
            metadata: message,
          });
          processed++;
        } catch (e: any) {
          httpStatus = 500;
          error = e.message;
          // Log but don't throw — webhook providers expect 200 even for
          // messages that fail business-logic validation.
        }

        // Record delivery regardless of success so retries are deduplicated.
        await this.prisma.webhookDelivery.create({
          data: {
            tenantId: account.tenantId,
            provider: 'META_CLOUD',
            providerEventId: message.id,
            eventType: 'message',
            payloadHash,
            httpStatus,
            error,
          },
        });
      }
    }
    return { processed, skipped };
  }

  verifyMetaWebhook(mode: string, token: string, challenge: string) {
    const expected = process.env.META_WHATSAPP_VERIFY_TOKEN;
    if (mode !== 'subscribe' || !expected || token !== expected) throw new BadRequestException('Invalid WhatsApp webhook verification');
    return challenge;
  }

  verifyMetaSignature(rawBody: Buffer, signatureHeader?: string) {
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) throw new BadRequestException('META_APP_SECRET is not configured');
    if (!signatureHeader?.startsWith('sha256=')) throw new BadRequestException('Missing WhatsApp webhook signature');
    const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const actual = signatureHeader.slice(7);
    const a = Buffer.from(expected, 'hex'); const b = Buffer.from(actual, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new BadRequestException('Invalid WhatsApp webhook signature');
    return true;
  }

  async processMetaStatuses(payload: any, rawBody: Buffer) {
    let updated = 0;
    let skipped = 0;
    const payloadHash = createHash('sha256').update(rawBody).digest('hex');

    for (const entry of (payload?.entry || [])) for (const change of (entry?.changes || [])) {
      const value = change?.value;
      for (const status of (value?.statuses || [])) {
        if (!status?.id) continue;

        // Phase 28: deduplicate status updates. Meta may redeliver the
        // same status webhook multiple times.
        const alreadyProcessed = await this.prisma.webhookDelivery.findUnique({
          where: { provider_providerEventId: { provider: 'META_CLOUD', providerEventId: status.id } },
        });
        if (alreadyProcessed) {
          skipped++;
          continue;
        }

        const data: any = {};
        if (status.status === 'delivered') data.deliveredAt = status.timestamp ? new Date(Number(status.timestamp) * 1000) : new Date();
        if (status.status === 'read') data.readAt = status.timestamp ? new Date(Number(status.timestamp) * 1000) : new Date();

        let httpStatus = 200;
        let error: string | null = null;
        let tenantId = 'unknown';

        try {
          if (Object.keys(data).length) {
            // Look up the message to get the correct tenant for the delivery record
            const msg = await this.prisma.whatsAppMessage.findFirst({
              where: { providerMessageId: status.id },
              select: { tenantId: true },
            });
            if (msg) tenantId = msg.tenantId;

            await this.prisma.whatsAppMessage.updateMany({
              where: { providerMessageId: status.id },
              data,
            });
            updated++;
          }
        } catch (e: any) {
          httpStatus = 500;
          error = e.message;
        }

        await this.prisma.webhookDelivery.create({
          data: {
            tenantId,
            provider: 'META_CLOUD',
            providerEventId: status.id,
            eventType: 'status',
            payloadHash,
            httpStatus,
            error,
          },
        });
      }
    }
    return { updated, skipped };
  }

  async receiveWebhook(tenantId: string, dto: ReceiveWhatsAppWebhookDto) {
    const account = await this.getAccount(dto.accountId, tenantId);
    const existing = await this.prisma.whatsAppMessage.findUnique({ where: { providerMessageId: dto.providerMessageId } });
    if (existing) return { duplicate: true, messageId: existing.id };

    const contact = await this.prisma.whatsAppContact.upsert({
      where: { accountId_phoneNumber: { accountId: account.id, phoneNumber: dto.from } },
      update: { lastSeenAt: new Date() },
      create: { tenantId, accountId: account.id, phoneNumber: dto.from, lastSeenAt: new Date() },
    });

    const conversation = await this.prisma.whatsAppConversation.upsert({
      where: { accountId_contactId: { accountId: account.id, contactId: contact.id } },
      update: { lastMessageAt: new Date(), status: 'OPEN' },
      create: { tenantId, accountId: account.id, contactId: contact.id, status: 'OPEN', lastMessageAt: new Date() },
    });

    const message = await this.prisma.whatsAppMessage.create({
      data: { tenantId, accountId: account.id, conversationId: conversation.id, providerMessageId: dto.providerMessageId, direction: 'INBOUND', type: dto.type, body: dto.body, metadata: dto.metadata as any },
    });
    await this.prisma.whatsAppConversation.update({ where: { id: conversation.id }, data: { unreadCount: { increment: 1 } } });

    // Keyword automation is deliberately best-effort: an automation failure
    // must never reject the inbound webhook after the message is persisted.
    if (conversation.botEnabled && dto.body) {
      const rule = await this.campaignService.findMatchingRule(tenantId, account.id, dto.body);
      if (rule) {
        try {
          const result = await this.providerFor(account.provider).sendText(account, dto.from, rule.responseText);
          await this.prisma.whatsAppMessage.create({ data: { tenantId, accountId: account.id, conversationId: conversation.id, providerMessageId: result.providerMessageId, direction: 'OUTBOUND', type: 'TEXT', body: rule.responseText } });
          await this.prisma.whatsAppConversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });
        } catch (_) { /* log/monitor in production; inbound processing remains successful */ }
      }
    }
    return { duplicate: false, message };
  }

  async sendMessage(tenantId: string, userId: string, accountId: string, dto: SendWhatsAppMessageDto) {
    const account = await this.getAccount(accountId, tenantId);
    if (account.status !== 'CONNECTED') throw new BadRequestException('WhatsApp account is not connected');

    let result: { providerMessageId: string };
    try {
      result = await this.providerFor(account.provider).sendText(account, dto.to, dto.body);
    } catch (error: any) {
      // Phase 30: create a placeholder message row so retry has something to track
      const contact = await this.prisma.whatsAppContact.upsert({
        where: { accountId_phoneNumber: { accountId, phoneNumber: dto.to } },
        update: { lastSeenAt: new Date() },
        create: { tenantId, accountId, phoneNumber: dto.to, lastSeenAt: new Date() },
      });
      const conversation = await this.prisma.whatsAppConversation.upsert({
        where: { accountId_contactId: { accountId, contactId: contact.id } },
        update: { lastMessageAt: new Date() },
        create: { tenantId, accountId, contactId: contact.id, status: 'OPEN', lastMessageAt: new Date() },
      });
      const failedMessage = await this.prisma.whatsAppMessage.create({
        data: {
          tenantId, accountId, conversationId: conversation.id,
          providerMessageId: `pending_${Date.now()}`,
          direction: 'OUTBOUND', type: dto.type, body: dto.body, mediaUrl: dto.mediaUrl,
          createdBy: userId, status: 'FAILED', failureReason: error.message,
        },
      });
      await this.retryService.handleSendFailure(failedMessage.id, error);
      throw error; // still bubble up so the caller knows the initial attempt failed
    }

    const contact = await this.prisma.whatsAppContact.upsert({
      where: { accountId_phoneNumber: { accountId, phoneNumber: dto.to } },
      update: { lastSeenAt: new Date() },
      create: { tenantId, accountId, phoneNumber: dto.to, lastSeenAt: new Date() },
    });
    const conversation = await this.prisma.whatsAppConversation.upsert({
      where: { accountId_contactId: { accountId, contactId: contact.id } },
      update: { lastMessageAt: new Date() },
      create: { tenantId, accountId, contactId: contact.id, status: 'OPEN', lastMessageAt: new Date() },
    });
    const message = await this.prisma.whatsAppMessage.create({
      data: { tenantId, accountId, conversationId: conversation.id, providerMessageId: result.providerMessageId, direction: 'OUTBOUND', type: dto.type, body: dto.body, mediaUrl: dto.mediaUrl, createdBy: userId },
    });
    return message;
  }

  getConversations(tenantId: string, search?: string, status?: 'OPEN'|'PENDING'|'CLOSED', assignedUserId?: string) {
    return this.prisma.whatsAppConversation.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
        ...(assignedUserId ? { assignedUserId } : {}),
        ...(search ? { contact: { OR: [{ name: { contains: search, mode: 'insensitive' } }, { phoneNumber: { contains: search } }] } } : {}),
      },
      include: { contact: true, account: true, assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: [{ archivedAt: 'asc' }, { lastMessageAt: 'desc' }],
    });
  }

  async getConversation(tenantId: string, conversationId: string) {
    const conversation = await this.prisma.whatsAppConversation.findFirst({
      where: { tenantId, id: conversationId },
      include: { contact: true, account: true, assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } }, messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  getMessages(tenantId: string, conversationId: string) {
    return this.prisma.whatsAppMessage.findMany({ where: { tenantId, conversationId }, orderBy: { createdAt: 'asc' } });
  }

  async listFailedMessages(tenantId: string, limit?: number) {
    return this.retryService.listFailedMessages(tenantId, limit);
  }

  async updateConversation(tenantId: string, userId: string, conversationId: string, dto: UpdateConversationDto) {
    const existing = await this.prisma.whatsAppConversation.findFirst({ where: { tenantId, id: conversationId } });
    if (!existing) throw new NotFoundException('Conversation not found');
    if (dto.assignedUserId) {
      const user = await this.prisma.user.findFirst({ where: { id: dto.assignedUserId, tenantId } });
      if (!user) throw new BadRequestException('Assigned user does not belong to this tenant');
    }
    const updated = await this.prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: {
        ...(dto.assignedUserId !== undefined ? { assignedUserId: dto.assignedUserId || null } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.botEnabled !== undefined ? { botEnabled: dto.botEnabled } : {}),
        ...(dto.archived !== undefined ? { archivedAt: dto.archived ? new Date() : null } : {}),
        ...(dto.tags ? { tags: dto.tags as any } : {}),
      },
    });
    await this.audit.log({ tenantId, userId, action: 'WHATSAPP_CONVERSATION_UPDATED', entityType: 'WhatsAppConversation', entityId: conversationId, newValues: dto });
    return updated;
  }

  async markRead(tenantId: string, userId: string, conversationId: string) {
    const existing = await this.prisma.whatsAppConversation.findFirst({ where: { tenantId, id: conversationId } });
    if (!existing) throw new NotFoundException('Conversation not found');
    const updated = await this.prisma.whatsAppConversation.update({ where: { id: conversationId }, data: { unreadCount: 0, lastReadAt: new Date() } });
    await this.audit.log({ tenantId, userId, action: 'WHATSAPP_CONVERSATION_READ', entityType: 'WhatsAppConversation', entityId: conversationId });
    return updated;
  }

  async addNote(tenantId: string, userId: string, conversationId: string, dto: AddNoteDto) {
    const existing = await this.prisma.whatsAppConversation.findFirst({ where: { tenantId, id: conversationId } });
    if (!existing) throw new NotFoundException('Conversation not found');
    const current = Array.isArray(existing.internalNotes) ? existing.internalNotes as any[] : [];
    const note = { id: randomUUID(), note: dto.note, userId, createdAt: new Date().toISOString() };
    const updated = await this.prisma.whatsAppConversation.update({ where: { id: conversationId }, data: { internalNotes: [...current, note] as any } });
    await this.audit.log({ tenantId, userId, action: 'WHATSAPP_CONVERSATION_NOTE_ADDED', entityType: 'WhatsAppConversation', entityId: conversationId });
    return updated;
  }

  async getCart(tenantId: string, conversationId: string) {
    const conversation = await this.prisma.whatsAppConversation.findFirst({
      where: { id: conversationId, tenantId },
      include: { account: true, contact: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const cart = await this.prisma.whatsAppCart.findFirst({
      where: { tenantId, conversationId, status: { in: ['ACTIVE', 'CHECKOUT'] } },
      include: { items: { include: { product: true } }, contact: true },
    });
    return cart;
  }

  async updateCart(tenantId: string, userId: string, conversationId: string, dto: UpdateCartDto) {
    const conversation = await this.prisma.whatsAppConversation.findFirst({
      where: { id: conversationId, tenantId },
      include: { account: true, contact: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const productIds = [...new Set(dto.items.map(i => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { tenantId, id: { in: productIds }, isActive: true },
    });
    const byId = new Map(products.map(p => [p.id, p]));
    if (products.length !== productIds.length) throw new BadRequestException('One or more products are unavailable');

    const normalized = dto.items.map(item => {
      const product = byId.get(item.productId)!;
      const unitPrice = item.unitPrice ?? Number(product.basePrice);
      const taxRate = item.taxRate ?? Number(product.taxRate);
      const discount = item.discount ?? 0;
      const subtotal = item.quantity * unitPrice;
      const tax = subtotal * taxRate / 100;
      const lineTotal = Math.max(0, subtotal + tax - discount);
      return { productId: item.productId, quantity: item.quantity, unitPrice, taxRate, discount, lineTotal };
    });

    const subtotal = normalized.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const taxAmount = normalized.reduce((sum, i) => sum + (i.quantity * i.unitPrice * i.taxRate / 100), 0);
    const discount = normalized.reduce((sum, i) => sum + i.discount, 0);
    const total = Math.max(0, subtotal + taxAmount - discount);

    const existing = await this.prisma.whatsAppCart.findFirst({ where: { tenantId, conversationId, status: { in: ['ACTIVE', 'CHECKOUT'] } } });
    const cart = existing
      ? await this.prisma.$transaction(async tx => {
          await tx.whatsAppCartItem.deleteMany({ where: { cartId: existing.id } });
          return tx.whatsAppCart.update({
            where: { id: existing.id },
            data: {
              currency: dto.currency || existing.currency,
              subtotal, taxAmount, discount, total, status: 'ACTIVE',
              items: { create: normalized },
            },
            include: { items: { include: { product: true } }, contact: true },
          });
        })
      : await this.prisma.whatsAppCart.create({
          data: {
            tenantId, accountId: conversation.accountId, contactId: conversation.contactId,
            conversationId, currency: dto.currency || 'MYR', subtotal, taxAmount, discount, total,
            items: { create: normalized },
          },
          include: { items: { include: { product: true } }, contact: true },
        });

    await this.audit.log({ tenantId, userId, action: 'WHATSAPP_CART_UPDATED', entityType: 'WhatsAppCart', entityId: cart.id, newValues: { itemCount: normalized.length, total } });
    return cart;
  }

  async assignCustomer(tenantId: string, userId: string, conversationId: string, dto: AssignCustomerDto) {
    const conversation = await this.prisma.whatsAppConversation.findFirst({ where: { id: conversationId, tenantId }, include: { contact: true } });
    if (!conversation) throw new NotFoundException('Conversation not found');

    let customerId = dto.customerId;
    if (customerId) {
      const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId, isActive: true } });
      if (!customer) throw new BadRequestException('Customer does not belong to this tenant');
    } else {
      const name = dto.name || conversation.contact.name || conversation.contact.phoneNumber;
      const customer = await this.prisma.customer.create({ data: { tenantId, name, phone: conversation.contact.phoneNumber, email: dto.email } });
      customerId = customer.id;
    }

    const updated = await this.prisma.whatsAppContact.update({ where: { id: conversation.contactId }, data: { customerId } });
    await this.audit.log({ tenantId, userId, action: 'WHATSAPP_CONTACT_CUSTOMER_ASSIGNED', entityType: 'WhatsAppContact', entityId: conversation.contactId, newValues: { customerId } });
    return updated;
  }

  async checkoutCart(tenantId: string, userId: string, conversationId: string, dto: CheckoutCartDto) {
    const conversation = await this.prisma.whatsAppConversation.findFirst({
      where: { id: conversationId, tenantId },
      include: { account: true, contact: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    let customerId = conversation.contact.customerId;
    if (!customerId) {
      const customer = await this.prisma.customer.create({
        data: { tenantId, name: conversation.contact.name || conversation.contact.phoneNumber, phone: conversation.contact.phoneNumber },
      });
      customerId = customer.id;
      await this.prisma.whatsAppContact.update({ where: { id: conversation.contactId }, data: { customerId } });
    }

    const cart = await this.prisma.whatsAppCart.findFirst({
      where: { tenantId, conversationId, status: 'ACTIVE' },
      include: { items: true },
    });
    if (!cart || cart.items.length === 0) throw new BadRequestException('Cart is empty');

    const salesRepId = conversation.assignedUserId || conversation.account.createdByUserId || userId;
    const order = await this.orders.create(tenantId, salesRepId, {
      customerId,
      source: 'WHATSAPP',
      notes: dto.notes,
      deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : undefined,
      items: cart.items.map(i => ({ productId: i.productId, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), taxRate: Number(i.taxRate), discount: Number(i.discount) })),
      discount: Number(cart.discount),
    });

    await this.prisma.whatsAppCart.update({ where: { id: cart.id }, data: { status: 'CONVERTED' } });
    await this.audit.log({ tenantId, userId, action: 'WHATSAPP_CART_CHECKED_OUT', entityType: 'WhatsAppCart', entityId: cart.id, newValues: { orderId: order.id, orderNumber: order.orderNumber } });
    return order;
  }

  // ───────────────────────────────────────────────
  // Phase 29 — Templates
  // ───────────────────────────────────────────────

  async listTemplates(tenantId: string, accountId?: string) {
    return this.prisma.whatsAppTemplate.findMany({
      where: { tenantId, ...(accountId ? { accountId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTemplate(tenantId: string, templateId: string) {
    const template = await this.prisma.whatsAppTemplate.findFirst({
      where: { id: templateId, tenantId },
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async createTemplate(tenantId: string, userId: string, data: {
    accountId: string;
    name: string;
    language?: string;
    category?: string;
    body: string;
    headerType?: string;
    headerText?: string;
    headerMediaUrl?: string;
    footer?: string;
    buttons?: any[];
  }) {
    const account = await this.getAccount(data.accountId, tenantId);
    if (account.provider === 'META_CLOUD') {
      // For Meta, template names must be lowercase alphanumeric + underscore
      const normalizedName = data.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (normalizedName !== data.name) {
        throw new BadRequestException('Meta template names must be lowercase alphanumeric with underscores only');
      }
    }

    const template = await this.prisma.whatsAppTemplate.create({
      data: {
        tenantId,
        accountId: data.accountId,
        name: data.name,
        language: data.language || 'en',
        category: data.category || 'MARKETING',
        body: data.body,
        headerType: data.headerType,
        headerText: data.headerText,
        headerMediaUrl: data.headerMediaUrl,
        footer: data.footer,
        buttons: data.buttons as any,
        createdByUserId: userId,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'WHATSAPP_TEMPLATE_CREATED',
      entityType: 'WhatsAppTemplate',
      entityId: template.id,
      newValues: { name: template.name, language: template.language },
    });

    return template;
  }

  async updateTemplate(tenantId: string, userId: string, templateId: string, data: {
    body?: string;
    headerType?: string;
    headerText?: string;
    headerMediaUrl?: string;
    footer?: string;
    buttons?: any[];
    status?: string;
  }) {
    const existing = await this.getTemplate(tenantId, templateId);

    const template = await this.prisma.whatsAppTemplate.update({
      where: { id: templateId },
      data: {
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.headerType !== undefined ? { headerType: data.headerType } : {}),
        ...(data.headerText !== undefined ? { headerText: data.headerText } : {}),
        ...(data.headerMediaUrl !== undefined ? { headerMediaUrl: data.headerMediaUrl } : {}),
        ...(data.footer !== undefined ? { footer: data.footer } : {}),
        ...(data.buttons !== undefined ? { buttons: data.buttons as any } : {}),
        ...(data.status ? { status: data.status as any } : {}),
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'WHATSAPP_TEMPLATE_UPDATED',
      entityType: 'WhatsAppTemplate',
      entityId: templateId,
      oldValues: existing,
      newValues: data,
    });

    return template;
  }

  async deleteTemplate(tenantId: string, userId: string, templateId: string) {
    await this.getTemplate(tenantId, templateId);
    await this.prisma.whatsAppTemplate.update({
      where: { id: templateId },
      data: { status: 'DELETED' },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'WHATSAPP_TEMPLATE_DELETED',
      entityType: 'WhatsAppTemplate',
      entityId: templateId,
    });

    return { success: true };
  }

  // ───────────────────────────────────────────────
  // Phase 29 — Send template message
  // ───────────────────────────────────────────────

  async sendTemplateMessage(tenantId: string, userId: string, accountId: string, dto: {
    to: string;
    templateName: string;
    language?: string;
    params?: Record<string, string>;
  }) {
    const account = await this.getAccount(accountId, tenantId);
    if (account.status !== 'CONNECTED') throw new BadRequestException('WhatsApp account is not connected');

    const template = await this.prisma.whatsAppTemplate.findFirst({
      where: { tenantId, accountId, name: dto.templateName, language: dto.language || 'en' },
    });
    if (!template) throw new NotFoundException('Template not found for this account');
    if (template.status !== 'APPROVED') throw new BadRequestException(`Template status is ${template.status}, must be APPROVED`);

    const result = await this.providerFor(account.provider).sendTemplate(account, dto.to, {
      name: dto.templateName,
      language: dto.language || 'en',
      params: dto.params,
    });

    const contact = await this.prisma.whatsAppContact.upsert({
      where: { accountId_phoneNumber: { accountId, phoneNumber: dto.to } },
      update: { lastSeenAt: new Date() },
      create: { tenantId, accountId, phoneNumber: dto.to, lastSeenAt: new Date() },
    });
    const conversation = await this.prisma.whatsAppConversation.upsert({
      where: { accountId_contactId: { accountId, contactId: contact.id } },
      update: { lastMessageAt: new Date() },
      create: { tenantId, accountId, contactId: contact.id, status: 'OPEN', lastMessageAt: new Date() },
    });
    const message = await this.prisma.whatsAppMessage.create({
      data: {
        tenantId,
        accountId,
        conversationId: conversation.id,
        providerMessageId: result.providerMessageId,
        direction: 'OUTBOUND',
        type: 'TEMPLATE',
        body: template.body,
        metadata: { templateName: dto.templateName, params: dto.params } as any,
        createdBy: userId,
      },
    });

    return message;
  }

  // ───────────────────────────────────────────────
  // Phase 29 — Send media message
  // ───────────────────────────────────────────────

  async sendMediaMessage(tenantId: string, userId: string, accountId: string, dto: {
    to: string;
    type: 'image' | 'document' | 'video' | 'audio';
    url: string;
    caption?: string;
    filename?: string;
  }) {
    const account = await this.getAccount(accountId, tenantId);
    if (account.status !== 'CONNECTED') throw new BadRequestException('WhatsApp account is not connected');

    const result = await this.providerFor(account.provider).sendMedia(account, dto.to, {
      type: dto.type,
      url: dto.url,
      caption: dto.caption,
      filename: dto.filename,
    });

    const contact = await this.prisma.whatsAppContact.upsert({
      where: { accountId_phoneNumber: { accountId, phoneNumber: dto.to } },
      update: { lastSeenAt: new Date() },
      create: { tenantId, accountId, phoneNumber: dto.to, lastSeenAt: new Date() },
    });
    const conversation = await this.prisma.whatsAppConversation.upsert({
      where: { accountId_contactId: { accountId, contactId: contact.id } },
      update: { lastMessageAt: new Date() },
      create: { tenantId, accountId, contactId: contact.id, status: 'OPEN', lastMessageAt: new Date() },
    });
    const message = await this.prisma.whatsAppMessage.create({
      data: {
        tenantId,
        accountId,
        conversationId: conversation.id,
        providerMessageId: result.providerMessageId,
        direction: 'OUTBOUND',
        type: dto.type.toUpperCase() as any,
        body: dto.caption || `[${dto.type}]`,
        mediaUrl: dto.url,
        metadata: { filename: dto.filename } as any,
        createdBy: userId,
      },
    });

    return message;
  }

  private async getAccount(id: string, tenantId: string) {
    const account = await this.prisma.whatsAppAccount.findFirst({ where: { id, tenantId } });
    if (!account) throw new NotFoundException('WhatsApp account not found');
    return account;
  }
}
