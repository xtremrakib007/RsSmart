import { IsArray, IsDateString, IsOptional, IsString, IsUrl, ArrayMinSize } from 'class-validator';

export class CreateCampaignDto {
  @IsString() name!: string;
  @IsString() accountId!: string;
  @IsString() messageTemplate!: string;
  @IsOptional() @IsUrl() mediaUrl?: string;
  @IsArray() @ArrayMinSize(1) recipients!: Array<{ phoneNumber: string; name?: string; customerId?: string }>;
  @IsOptional() @IsDateString() scheduledAt?: string;
}
