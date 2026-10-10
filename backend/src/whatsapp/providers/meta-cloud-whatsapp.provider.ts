import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { WhatsAppProvider, WhatsAppProviderAccount, WhatsAppTemplateParams, WhatsAppMediaMessage } from './whatsapp-provider';
import { WhatsAppCredentialService } from '../security/whatsapp-credential.service';

@Injectable()
export class MetaCloudWhatsAppProvider implements WhatsAppProvider {
  private readonly graphVersion = process.env.META_GRAPH_VERSION || 'v23.0';
  private readonly baseUrl = `https://graph.facebook.com/${this.graphVersion}`;
  constructor(private readonly credentials: WhatsAppCredentialService) {}

  private token(account: WhatsAppProviderAccount) {
    const token = this.credentials.decrypt(account.accessTokenEncrypted) || process.env.META_WHATSAPP_ACCESS_TOKEN;
    if (!token) throw new ServiceUnavailableException('No WhatsApp Cloud API access token configured for this account');
    return token;
  }

  async connect(account: WhatsAppProviderAccount) {
    if (!account.phoneNumberId) throw new ServiceUnavailableException('WhatsApp phoneNumberId is required');
    const response = await fetch(`${this.baseUrl}/${encodeURIComponent(account.phoneNumberId)}?fields=id,display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${this.token(account)}` } });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new ServiceUnavailableException(data?.error?.message || `Meta verification failed (${response.status})`);
    return { status: 'CONNECTED' };
  }

  async disconnect(_account: { id: string }) {}

  async sendText(account: WhatsAppProviderAccount, to: string, body: string) {
    if (!account.phoneNumberId) throw new ServiceUnavailableException('WhatsApp phoneNumberId is required');
    const response = await fetch(`${this.baseUrl}/${encodeURIComponent(account.phoneNumberId)}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${this.token(account)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body } }),
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new ServiceUnavailableException(data?.error?.message || `Meta send failed (${response.status})`);
    const providerMessageId = data?.messages?.[0]?.id;
    if (!providerMessageId) throw new ServiceUnavailableException('Meta response did not contain a message id');
    return { providerMessageId };
  }

  // Phase 29: send a pre-approved template message
  async sendTemplate(account: WhatsAppProviderAccount, to: string, template: WhatsAppTemplateParams) {
    if (!account.phoneNumberId) throw new ServiceUnavailableException('WhatsApp phoneNumberId is required');

    const components: any[] = [];
    if (template.params && Object.keys(template.params).length > 0) {
      const bodyParams = Object.entries(template.params).map(([key, value]) => ({
        type: 'text',
        text: value,
      }));
      components.push({ type: 'body', parameters: bodyParams });
    }

    const response = await fetch(`${this.baseUrl}/${encodeURIComponent(account.phoneNumberId)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token(account)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: template.name,
          language: { code: template.language },
          ...(components.length ? { components } : {}),
        },
      }),
    });

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new ServiceUnavailableException(data?.error?.message || `Meta template send failed (${response.status})`);
    const providerMessageId = data?.messages?.[0]?.id;
    if (!providerMessageId) throw new ServiceUnavailableException('Meta response did not contain a message id');
    return { providerMessageId };
  }

  // Phase 29: send media (image, document, video, audio)
  async sendMedia(account: WhatsAppProviderAccount, to: string, media: WhatsAppMediaMessage) {
    if (!account.phoneNumberId) throw new ServiceUnavailableException('WhatsApp phoneNumberId is required');

    const mediaPayload: any = {
      link: media.url,
      ...(media.caption ? { caption: media.caption } : {}),
      ...(media.filename ? { filename: media.filename } : {}),
    };

    const response = await fetch(`${this.baseUrl}/${encodeURIComponent(account.phoneNumberId)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token(account)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: media.type,
        [media.type]: mediaPayload,
      }),
    });

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new ServiceUnavailableException(data?.error?.message || `Meta media send failed (${response.status})`);
    const providerMessageId = data?.messages?.[0]?.id;
    if (!providerMessageId) throw new ServiceUnavailableException('Meta response did not contain a message id');
    return { providerMessageId };
  }

  // Phase 29: upload media to Meta's servers and return a media ID
  async uploadMedia(account: WhatsAppProviderAccount, file: Buffer, mimeType: string) {
    if (!account.phoneNumberId) throw new ServiceUnavailableException('WhatsApp phoneNumberId is required');

    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(file)], { type: mimeType }), 'file');
    formData.append('messaging_product', 'whatsapp');

    const response = await fetch(`${this.baseUrl}/${encodeURIComponent(account.phoneNumberId)}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token(account)}` },
      body: formData as any,
    });

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new ServiceUnavailableException(data?.error?.message || `Meta media upload failed (${response.status})`);
    return { mediaId: data.id };
  }
}
