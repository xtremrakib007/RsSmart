import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendTemplateDto {
  @IsString()
  @MaxLength(30)
  to!: string;

  @IsString()
  @MaxLength(120)
  templateName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsObject()
  params?: Record<string, string>;
}
