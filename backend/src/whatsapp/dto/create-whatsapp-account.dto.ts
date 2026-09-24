import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateWhatsAppAccountDto {
  @IsString() @MaxLength(120) displayName!: string;
  @IsOptional() @IsString() @MaxLength(40) phoneNumber?: string;
  @IsOptional() @IsIn(['MOCK', 'META_CLOUD']) provider?: string;
  @IsOptional() @IsString() providerAccountId?: string;
  @IsOptional() @IsString() phoneNumberId?: string;
  @IsOptional() @IsString() webhookUrl?: string;
  /** Stored encrypted at rest; never returned by account APIs. */
  @IsOptional() @IsString() accessToken?: string;
}
