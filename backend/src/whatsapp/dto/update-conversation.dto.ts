import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateConversationDto {
  @IsOptional() @IsString() assignedUserId?: string;
  @IsOptional() @IsEnum(['OPEN','PENDING','CLOSED']) status?: 'OPEN'|'PENDING'|'CLOSED';
  @IsOptional() @IsBoolean() botEnabled?: boolean;
  @IsOptional() @IsBoolean() archived?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}
