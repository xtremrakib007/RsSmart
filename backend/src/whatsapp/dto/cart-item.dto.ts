import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CartItemDto {
  @IsString() productId!: string;
  @IsNumber() @Min(0.001) quantity!: number;
  @IsOptional() @IsNumber() @Min(0) unitPrice?: number;
  @IsOptional() @IsNumber() @Min(0) taxRate?: number;
  @IsOptional() @IsNumber() @Min(0) discount?: number;
}
