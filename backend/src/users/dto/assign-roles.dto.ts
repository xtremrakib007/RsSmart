import { IsArray, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignRolesDto {
  @ApiProperty({ example: ['role-uuid-1', 'role-uuid-2'] })
  @IsArray()
  @ArrayNotEmpty()
  roleIds: string[];
}
