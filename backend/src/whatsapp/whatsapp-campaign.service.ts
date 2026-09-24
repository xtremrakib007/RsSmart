import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WhatsAppAutomationTrigger, WhatsAppCampaignStatus, WhatsAppRecipientStatus } from '@prisma/client';

@Injectable()
export class WhatsAppCampaignService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, @InjectQueue('whatsapp') private readonly queue: Queue) {}

  async createCampaign(tenantId: string, userId: string, dto: CreateCampaignDto) {
    const account = await this.prisma.whatsAppAccount.findFirst({ where: { id: dto.accountId, tenantId } });
    if (!account) throw new NotFoundException('WhatsApp account not found');
    if (account.status !== 'CONNECTED') throw new BadRequestException('WhatsApp account is not connected');
    const unique = Array.from(new Map(dto.recipients.map(r => [r.phoneNumber.replace(/[^0-9]/g, ''), r])).values());
    if (!unique.length) throw new BadRequestException('At least one recipient is required');
    const campaign = await this.prisma.whatsAppCampaign.create({ data: { tenantId, accountId: dto.accountId, name: dto.name, messageTemplate: dto.messageTemplate, mediaUrl: dto.mediaUrl, scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null, createdByUserId: userId, totalRecipients: unique.length, recipients: { create: unique.map(r => ({ tenantId, phoneNumber: r.phoneNumber.replace(/[^0-9]/g, ''), name: r.name, customerId: r.customerId })) } }, include: { recipients: true } });
    await this.audit.log({ tenantId, userId, action: 'WHATSAPP_CAMPAIGN_CREATED', entityType: 'WhatsAppCampaign', entityId: campaign.id, newValues: { recipientCount: unique.length } });
    if (campaign.scheduledAt) { await this.queue.add('campaign-start', { campaignId: campaign.id, tenantId }, { delay: Math.max(0, campaign.scheduledAt.getTime() - Date.now()), jobId: `campaign-${campaign.id}`, removeOnComplete: 100, removeOnFail: 100 }); }
    return campaign;
  }

  listCampaigns(tenantId: string) { return this.prisma.whatsAppCampaign.findMany({ where: { tenantId }, include: { account: true, _count: { select: { recipients: true } } }, orderBy: { createdAt: 'desc' } }); }

  async startCampaign(tenantId: string, userId: string, campaignId: string) {
    const campaign = await this.prisma.whatsAppCampaign.findFirst({ where: { id: campaignId, tenantId }, include: { recipients: true, account: true } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status === WhatsAppCampaignStatus.COMPLETED || campaign.status === WhatsAppCampaignStatus.CANCELLED) throw new BadRequestException('Campaign cannot be started');
    if (campaign.account.status !== 'CONNECTED') throw new BadRequestException('WhatsApp account is not connected');
    await this.prisma.whatsAppCampaign.update({ where: { id: campaign.id }, data: { status: 'QUEUED', startedAt: new Date(), queuedCount: campaign.recipients.filter(r => r.status === WhatsAppRecipientStatus.QUEUED).length } });
    for (const recipient of campaign.recipients.filter(r => r.status === WhatsAppRecipientStatus.QUEUED)) await this.queue.add('campaign-recipient', { campaignId: campaign.id, recipientId: recipient.id, tenantId }, { attempts: 4, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 500, removeOnFail: 500 });
    await this.audit.log({ tenantId, userId, action: 'WHATSAPP_CAMPAIGN_STARTED', entityType: 'WhatsAppCampaign', entityId: campaign.id });
    return this.prisma.whatsAppCampaign.findUnique({ where: { id: campaign.id }, include: { recipients: true } });
  }

  async cancelCampaign(tenantId: string, userId: string, id: string) { const c=await this.prisma.whatsAppCampaign.findFirst({where:{id,tenantId}}); if(!c) throw new NotFoundException('Campaign not found'); const u=await this.prisma.whatsAppCampaign.update({where:{id},data:{status:'CANCELLED'}}); await this.audit.log({tenantId,userId,action:'WHATSAPP_CAMPAIGN_CANCELLED',entityType:'WhatsAppCampaign',entityId:id}); return u; }

  createRule(tenantId: string, userId: string, dto: CreateAutomationRuleDto) { return this.prisma.whatsAppAutomationRule.create({ data: { tenantId, createdByUserId: userId, name: dto.name, accountId: dto.accountId, triggerType: dto.triggerType, triggerValue: dto.triggerValue, responseText: dto.responseText, enabled: dto.enabled ?? true, priority: dto.priority ?? 100 } }); }
  listRules(tenantId: string) { return this.prisma.whatsAppAutomationRule.findMany({ where: { tenantId }, orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }] }); }
  async deleteRule(tenantId: string, userId: string, id: string) { const r=await this.prisma.whatsAppAutomationRule.findFirst({where:{id,tenantId}}); if(!r) throw new NotFoundException('Automation rule not found'); const d=await this.prisma.whatsAppAutomationRule.delete({where:{id}}); await this.audit.log({tenantId,userId,action:'WHATSAPP_AUTOMATION_RULE_DELETED',entityType:'WhatsAppAutomationRule',entityId:id}); return d; }

  async findMatchingRule(tenantId: string, accountId: string, text: string) {
    const rules = await this.prisma.whatsAppAutomationRule.findMany({ where: { tenantId, enabled: true, OR: [{ accountId }, { accountId: null }] }, orderBy: { priority: 'asc' } });
    const normalized=text.trim().toLowerCase();
    return rules.find(r => r.triggerType === WhatsAppAutomationTrigger.KEYWORD ? normalized.includes(r.triggerValue.toLowerCase()) : r.triggerType === WhatsAppAutomationTrigger.EXACT_TEXT ? normalized === r.triggerValue.toLowerCase() : normalized.startsWith(r.triggerValue.toLowerCase()));
  }
}
