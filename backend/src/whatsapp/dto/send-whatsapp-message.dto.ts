import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendWhatsAppMessageDto {
  @IsString()
  @MaxLength(30)
  to!: string;

  @IsIn(['TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO'])
  type!: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO';

  @IsString()
  @MaxLength(4096)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  mediaUrl?: string;
}
