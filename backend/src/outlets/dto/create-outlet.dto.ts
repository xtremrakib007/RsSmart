import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOutletDto {
  @ApiProperty({ example: 'JB-01', description: 'Short unique code for this outlet within the company' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @ApiProperty({ example: 'Johor Bahru Branch' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: '12 Jalan Wong Ah Fook, 80000 Johor Bahru' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Asia/Kuala_Lumpur' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'MYR' })
  @IsOptional()
  @IsString()
  currency?: string;
}
