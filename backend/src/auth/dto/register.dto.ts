// NOTE (Phase 12): this DTO is intentionally no longer wired to any public
// controller route. The old public `POST /auth/register` accepted a
// client-supplied tenantId and roleIds, letting any anonymous caller attach
// themselves to an arbitrary existing company with an arbitrary role — see
// the Phase 12 security finding. It has been replaced by:
//   - POST /auth/register (public) -> RegisterCompanyDto, always creates a
//     brand new company and its owner.
//   - POST /users/invite (authenticated, requires users.manage) -> invites
//     into the CALLER's own tenant, with tenantId taken from the session.
// This file is kept only so nothing else in the repo referencing the old
// shape breaks at compile time; it is not imported by any controller.
import { IsEmail, IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@company.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'tenant-uuid' })
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @ApiPropertyOptional({ example: ['role-uuid-1'] })
  @IsOptional()
  @IsArray()
  roleIds?: string[];
}
