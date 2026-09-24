import { BadRequestException, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

@Injectable()
export class WhatsAppCredentialService {
  private key() {
    const raw = process.env.WHATSAPP_CREDENTIAL_ENCRYPTION_KEY;
    if (!raw) throw new BadRequestException('WHATSAPP_CREDENTIAL_ENCRYPTION_KEY is not configured');
    return createHash('sha256').update(raw).digest();
  }

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
  }

  decrypt(payload?: string | null): string | null {
    if (!payload) return null;
    const [ivRaw, tagRaw, dataRaw] = payload.split('.');
    if (!ivRaw || !tagRaw || !dataRaw) throw new BadRequestException('Invalid encrypted WhatsApp credential');
    const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(ivRaw, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(dataRaw, 'base64url')), decipher.final()]).toString('utf8');
  }
}
