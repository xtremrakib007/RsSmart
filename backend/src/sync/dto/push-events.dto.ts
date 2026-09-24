import { IsString, IsArray, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PushEventsDto {
  @ApiProperty()
  @IsString()
  clientId: string;

  @ApiProperty({ type: 'array' })
  @IsArray()
  events: SyncEventDto[];
}

export class SyncEventDto {
  @ApiProperty()
  @IsString()
  eventId: string;

  @ApiProperty()
  @IsString()
  entityType: string;

  @ApiProperty()
  @IsString()
  entityId: string;

  @ApiProperty({ enum: ['CREATE', 'UPDATE', 'DELETE'] })
  action: 'CREATE' | 'UPDATE' | 'DELETE';

  @ApiProperty({ type: 'object' })
  payload: Record<string, any>;

  @ApiProperty({ type: 'object', required: false })
  @IsOptional()
  vectorClock?: Record<string, number>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isDelta?: boolean;
}
