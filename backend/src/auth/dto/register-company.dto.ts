import { IsEmail, IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Replaces the old RegisterDto for the public endpoint. Deliberately has NO
// tenantId or roleIds field: this endpoint always creates a brand new
// company and its owner, never joins an existing one (see
// AuthService.registerCompany). Joining an EXISTING company happens through
// the authenticated invite flow instead (POST /users/invite).
export class RegisterCompanyDto {
  @ApiProperty({ example: 'Acme Sdn Bhd' })
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @ApiProperty({ example: 'owner@acme.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;
}
