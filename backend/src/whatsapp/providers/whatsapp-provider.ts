export interface WhatsAppProviderAccount {
  id: string;
  phoneNumber?: string | null;
  phoneNumberId?: string | null;
  accessTokenEncrypted?: string | null;
}

export interface WhatsAppTemplateParams {
  name: string;
  language: string;
  params?: Record<string, string>;
}

export interface WhatsAppMediaMessage {
  type: 'image' | 'document' | 'video' | 'audio';
  url: string;
  caption?: string;
  filename?: string;
}

export interface WhatsAppProvider {
  connect(account: WhatsAppProviderAccount): Promise<{ status: string; qr?: string }>;
  disconnect(account: { id: string }): Promise<void>;
  sendText(account: WhatsAppProviderAccount, to: string, body: string): Promise<{ providerMessageId: string }>;
  sendTemplate(account: WhatsAppProviderAccount, to: string, template: WhatsAppTemplateParams): Promise<{ providerMessageId: string }>;
  sendMedia(account: WhatsAppProviderAccount, to: string, media: WhatsAppMediaMessage): Promise<{ providerMessageId: string }>;
}
