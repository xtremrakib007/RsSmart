import { IsHexColor, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateBrandingDto {
  // The name shown in-app (title bars, headers, receipts). Defaults to the
  // tenant's registered company name (Tenant.name) if never set.
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsHexColor()
  primaryColor?: string;
}
