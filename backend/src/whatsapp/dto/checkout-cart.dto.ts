import { IsOptional, IsString } from 'class-validator';

export class CheckoutCartDto {
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() deliveryDate?: string;
}
