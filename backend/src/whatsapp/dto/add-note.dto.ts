import { IsString, MaxLength } from 'class-validator';

export class AddNoteDto {
  @IsString() @MaxLength(2000) note!: string;
}
