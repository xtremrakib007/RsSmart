import { IsEmail, IsString, IsNotEmpty, IsArray, ArrayNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Deliberately has no tenantId or password field. tenantId always comes
// from the caller's own session (see InvitationsService.create); password
// is chosen by the invitee themselves when they accept, not by the
// inviter — the whole point of this flow over the older
// AuthService.inviteUser direct-create path.
export class CreateInvitationDto {
  @ApiProperty({ example: 'cashier@acme.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Jane' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Smith' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: ['role-uuid-1'], description: "Must be role IDs belonging to the caller's own company" })
  @IsArray()
  @ArrayNotEmpty()
  roleIds: string[];

  @ApiPropertyOptional({ example: ['outlet-uuid-1'], description: 'Defaults to the company default outlet if omitted' })
  @IsOptional()
  @IsArray()
  outletIds?: string[];
}
