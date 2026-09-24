import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Deliberately narrow: no email/password/tenantId/status here. Password
// resets and status changes go through their own endpoints so they get
// their own audit trail and (for status) session-revocation logic.
export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastName?: string;
}
