import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service';
import { MockWhatsAppProvider } from './providers/mock-whatsapp.provider';

@Processor('whatsapp')
export class WhatsAppCampaignProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService, private readonly provider: MockWhatsAppProvider, @InjectQueue('whatsapp') private readonly queue: Queue) { super(); }

  async process(job: Job): Promise<void> {
    if (job.name === 'campaign-start') return this.start(job);
    if (job.name === 'campaign-recipient') return this.sendRecipient(job);
    throw new Error(`Unknown WhatsApp job: ${job.name}`);
  }

  private async start(job: Job) {
    const campaign = await this.prisma.whatsAppCampaign.findFirst({ where: { id: job.data.campaignId, tenantId: job.data.tenantId }, include: { recipients: true, account: true } });
    if (!campaign || campaign.status === 'CANCELLED') return;
    if (campaign.account.status !== 'CONNECTED') { await this.prisma.whatsAppCampaign.update({ where: { id: campaign.id }, data: { status: 'FAILED' } }); return; }
    await this.prisma.whatsAppCampaign.update({ where: { id: campaign.id }, data: { status: 'RUNNING', startedAt: campaign.startedAt || new Date(), queuedCount: campaign.recipients.filter(r => r.status === 'QUEUED').length } });
    for (const recipient of campaign.recipients.filter(r => r.status === 'QUEUED')) await this.queueRecipient(campaign.id, recipient.id, campaign.tenantId);
  }

  private async queueRecipient(campaignId: string, recipientId: string, tenantId: string) {
    await this.queue.add('campaign-recipient', { campaignId, recipientId, tenantId }, { attempts: 4, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 500, removeOnFail: 500 });
  }

  private async sendRecipient(job: Job) {
    const recipient = await this.prisma.whatsAppCampaignRecipient.findUnique({ where: { id: job.data.recipientId }, include: { campaign: { include: { account: true } } } });
    if (!recipient || recipient.status !== 'QUEUED') return;
    const campaign = recipient.campaign;
    if (campaign.status === 'CANCELLED') return;
    if (campaign.account.status !== 'CONNECTED') throw new Error('WhatsApp account is not connected');
    const body = campaign.messageTemplate.replace(/\{\{name\}\}/gi, recipient.name || 'there').replace(/\{\{phone\}\}/gi, recipient.phoneNumber);
    try {
      const result = await this.provider.sendText(campaign.account, recipient.phoneNumber, body);
      await this.prisma.$transaction([
        this.prisma.whatsAppCampaignRecipient.update({ where: { id: recipient.id }, data: { status: 'SENT', providerMessageId: result.providerMessageId, sentAt: new Date() } }),
        this.prisma.whatsAppCampaign.update({ where: { id: campaign.id }, data: { sentCount: { increment: 1 } } }),
      ]);
      await this.prisma.whatsAppMessage.create({ data: { tenantId: campaign.tenantId, accountId: campaign.accountId, conversationId: await this.ensureConversation(campaign.tenantId, campaign.accountId, recipient.phoneNumber), providerMessageId: result.providerMessageId, direction: 'OUTBOUND', type: 'TEXT', body } });
      await this.finalizeIfComplete(campaign.id);
    } catch (e: any) {
      await this.prisma.$transaction([
        this.prisma.whatsAppCampaignRecipient.update({ where: { id: recipient.id }, data: { status: 'FAILED', error: e?.message || 'Send failed' } }),
        this.prisma.whatsAppCampaign.update({ where: { id: campaign.id }, data: { failedCount: { increment: 1 } } }),
      ]);
      await this.finalizeIfComplete(campaign.id);
      throw e;
    }
  }

  private async ensureConversation(tenantId: string, accountId: string, phone: string) {
    const contact = await this.prisma.whatsAppContact.upsert({ where: { accountId_phoneNumber: { accountId, phoneNumber: phone } }, update: { lastSeenAt: new Date() }, create: { tenantId, accountId, phoneNumber: phone } });
    const conversation = await this.prisma.whatsAppConversation.upsert({ where: { accountId_contactId: { accountId, contactId: contact.id } }, update: { lastMessageAt: new Date() }, create: { tenantId, accountId, contactId: contact.id, status: 'OPEN', lastMessageAt: new Date() } });
    return conversation.id;
  }

  private async finalizeIfComplete(campaignId: string) {
    const pending = await this.prisma.whatsAppCampaignRecipient.count({ where: { campaignId, status: 'QUEUED' } });
    if (pending) return;
    const c = await this.prisma.whatsAppCampaign.findUnique({ where: { id: campaignId } });
    if (!c) return;
    const status = c.failedCount ? (c.sentCount ? 'PARTIAL' : 'FAILED') : 'COMPLETED';
    await this.prisma.whatsAppCampaign.update({ where: { id: campaignId }, data: { status, completedAt: new Date() } });
  }
}
