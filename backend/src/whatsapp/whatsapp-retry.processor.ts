import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { WhatsAppRetryService } from './whatsapp-retry.service';
import { MetaCloudWhatsAppProvider } from './providers/meta-cloud-whatsapp.provider';
import { MockWhatsAppProvider } from './providers/mock-whatsapp.provider';

/**
 * BullMQ worker for WhatsApp message retries (Phase 30).
 * Processes jobs from the 'whatsapp-retry' queue.
 */
@Processor('whatsapp-retry')
export class WhatsAppRetryProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsAppRetryProcessor.name);

  constructor(
    private retryService: WhatsAppRetryService,
    private metaProvider: MetaCloudWhatsAppProvider,
    private mockProvider: MockWhatsAppProvider,
  ) {
    super();
  }

  async process(job: Job<{ messageId: string }>): Promise<any> {
    const { messageId } = job.data;
    this.logger.log(`Processing retry for message ${messageId} (attempt ${job.attemptsMade + 1})`);

    return this.retryService.processRetry(messageId, async (message: any) => {
      const provider = message.account?.provider === 'META_CLOUD'
        ? this.metaProvider
        : this.mockProvider;

      if (message.type === 'TEMPLATE') {
        // Template retry: we don't store template params on the message row,
        // so permanent-failed template retries need manual re-send.
        throw new Error('Template message retry not supported — re-send manually');
      }

      if (message.type === 'TEXT') {
        const contactPhone = message.conversation?.contact?.phoneNumber;
        if (!contactPhone) throw new Error('Cannot retry: missing contact phone number');
        await provider.sendText(message.account, contactPhone, message.body);
        return;
      }

      if (['IMAGE', 'DOCUMENT', 'VIDEO', 'AUDIO'].includes(message.type)) {
        const contactPhone = message.conversation?.contact?.phoneNumber;
        if (!contactPhone) throw new Error('Cannot retry: missing contact phone number');
        await provider.sendMedia(message.account, contactPhone, {
          type: message.type.toLowerCase(),
          url: message.mediaUrl,
        });
        return;
      }

      throw new Error(`Retry not implemented for message type ${message.type}`);
    });
  }
}
