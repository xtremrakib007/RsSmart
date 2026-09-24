import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @MaxLength(64)
  accountId!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsIn(['UTILITY', 'MARKETING', 'AUTHENTICATION'])
  category?: string;

  @IsString()
  @MaxLength(1024)
  body!: string;

  @IsOptional()
  @IsIn(['TEXT', 'IMAGE', 'DOCUMENT', 'VIDEO'])
  headerType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  headerText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  headerMediaUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  footer?: string;

  @IsOptional()
  @IsArray()
  buttons?: any[];
}
