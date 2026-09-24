import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { WhatsAppProvider, WhatsAppTemplateParams, WhatsAppMediaMessage } from './whatsapp-provider';

@Injectable()
export class MockWhatsAppProvider implements WhatsAppProvider {
  async connect(account: { id: string; phoneNumber?: string | null }) {
    return { status: 'CONNECTED', qr: undefined };
  }

  async disconnect(_account: { id: string }) {
    return;
  }

  async sendText(_account: { id: string }, _to: string, _body: string) {
    return { providerMessageId: `mock-text-${randomUUID()}` };
  }

  async sendTemplate(_account: { id: string }, _to: string, template: WhatsAppTemplateParams) {
    return { providerMessageId: `mock-template-${template.name}-${randomUUID()}` };
  }

  async sendMedia(_account: { id: string }, _to: string, media: WhatsAppMediaMessage) {
    return { providerMessageId: `mock-media-${media.type}-${randomUUID()}` };
  }
}
