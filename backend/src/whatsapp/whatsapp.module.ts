import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { MockWhatsAppProvider } from './providers/mock-whatsapp.provider';
import { MetaCloudWhatsAppProvider } from './providers/meta-cloud-whatsapp.provider';
import { OrdersModule } from '../orders/orders.module';
import { BullModule } from '@nestjs/bullmq';
import { WhatsAppCampaignService } from './whatsapp-campaign.service';
import { WhatsAppCampaignProcessor } from './whatsapp-campaign.processor';
import { WhatsAppCredentialService } from './security/whatsapp-credential.service';
import { WhatsAppRetryService } from './whatsapp-retry.service';
import { WhatsAppRetryProcessor } from './whatsapp-retry.processor';

@Module({
  imports: [
    AuditModule,
    OrdersModule,
    BullModule.registerQueue({ name: 'whatsapp' }),
    BullModule.registerQueue({ name: 'whatsapp-retry' }),
  ],
  controllers: [WhatsAppController],
  providers: [
    WhatsAppService,
    MockWhatsAppProvider,
    MetaCloudWhatsAppProvider,
    WhatsAppCredentialService,
    WhatsAppCampaignService,
    WhatsAppCampaignProcessor,
    WhatsAppRetryService,
    WhatsAppRetryProcessor,
  ],
  exports: [WhatsAppService, WhatsAppRetryService],
})
export class WhatsAppModule {}
