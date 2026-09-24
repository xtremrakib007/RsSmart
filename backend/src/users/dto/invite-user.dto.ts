import { IsEmail, IsString, IsNotEmpty, MinLength, IsArray, ArrayNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Deliberately has no tenantId field — the invite always applies to the
// authenticated caller's own company (see AuthService.inviteUser).
export class InviteUserDto {
  @ApiProperty({ example: 'cashier@acme.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'temporaryPassword123' })
  @IsString()
  @MinLength(8)
  password: string;

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
