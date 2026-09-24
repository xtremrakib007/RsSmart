import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { WhatsAppAutomationTrigger } from '@prisma/client';

export class CreateAutomationRuleDto {
  @IsString() name!: string;
  @IsOptional() @IsString() accountId?: string;
  @IsEnum(WhatsAppAutomationTrigger) triggerType!: WhatsAppAutomationTrigger;
  @IsString() triggerValue!: string;
  @IsString() responseText!: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsInt() @Min(1) priority?: number;
}
