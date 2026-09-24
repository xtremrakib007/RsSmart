import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  body?: string;

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

  @IsOptional()
  @IsIn(['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAUSED', 'DELETED'])
  status?: string;
}
