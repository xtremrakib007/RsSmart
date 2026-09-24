import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantsService } from './tenants.service';
import { UpdateBrandingDto } from './dto/update-branding.dto';

// Every endpoint here derives tenantId from the authenticated user's JWT
// (@CurrentUser), never from a client-supplied param — a tenant can only ever
// read or change its own branding, matching how every other module in this
// backend scopes data (see products/orders/etc).
@ApiTags('Tenants')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('tenants/me')
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  @Get('branding')
  @ApiOperation({ summary: "Get the caller's tenant branding (name, logo, color)" })
  getBranding(@CurrentUser() user: any) {
    return this.tenantsService.getBranding(user.tenantId);
  }

  @Put('branding')
  @Roles('admin')
  @ApiOperation({ summary: "Update the caller's tenant branding" })
  updateBranding(@Body() dto: UpdateBrandingDto, @CurrentUser() user: any) {
    return this.tenantsService.updateBranding(user.tenantId, dto);
  }
}
