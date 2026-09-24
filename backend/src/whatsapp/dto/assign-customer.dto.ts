import { IsOptional, IsString } from 'class-validator';

export class AssignCustomerDto {
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() email?: string;
}
