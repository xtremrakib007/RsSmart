import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReceiveWhatsAppWebhookDto {
  @IsString()
  @MaxLength(200)
  eventId!: string;

  @IsString()
  @MaxLength(100)
  accountId!: string;

  @IsString()
  @MaxLength(100)
  providerMessageId!: string;

  @IsString()
  @MaxLength(30)
  from!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  to?: string;

  @IsIn(['TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'SYSTEM'])
  type!: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'SYSTEM';

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  body?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
