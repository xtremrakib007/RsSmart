import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendMediaDto {
  @IsString()
  @MaxLength(30)
  to!: string;

  @IsIn(['image', 'document', 'video', 'audio'])
  type!: 'image' | 'document' | 'video' | 'audio';

  @IsString()
  @MaxLength(1000)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  caption?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  filename?: string;
}
