import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PullEventsDto {
  @ApiProperty()
  @IsString()
  clientId: string;

  @ApiProperty()
  @IsString()
  lastSyncAt: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  entities?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  deltaOnly?: boolean;
  limit?: number;
}
