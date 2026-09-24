import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AcceptInvitationDto {
  @ApiProperty({ example: 'the-raw-token-from-the-invite-link' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'aStrongPassword123' })
  @IsString()
  @MinLength(8)
  password: string;
}
