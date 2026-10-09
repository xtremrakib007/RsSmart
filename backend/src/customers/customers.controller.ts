import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CustomersService } from './customers.service';
import { CurrentUser } from '../common/decorators/user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('customers')
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Get()
  @RequirePermissions(Permission.CUSTOMERS_READ)
  @ApiOperation({ summary: 'Get all customers' })
  findAll(
    @CurrentUser() user: any,
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    return this.customersService.findAll(user.tenantId, { search, category });
  }

  @Get(':id')
  @RequirePermissions(Permission.CUSTOMERS_READ)
  @ApiOperation({ summary: 'Get customer by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customersService.findOne(id, user.tenantId);
  }

  @Post()
  @RequirePermissions(Permission.CUSTOMERS_WRITE)
  @ApiOperation({ summary: 'Create customer' })
  create(@Body() data: any, @CurrentUser() user: any) {
    return this.customersService.create(user.tenantId, data);
  }

  @Put(':id')
  @RequirePermissions(Permission.CUSTOMERS_WRITE)
  @ApiOperation({ summary: 'Update customer' })
  update(@Param('id') id: string, @Body() data: any, @CurrentUser() user: any) {
    return this.customersService.update(id, user.tenantId, data);
  }

  @Delete(':id')
  @RequirePermissions(Permission.CUSTOMERS_WRITE)
  @ApiOperation({ summary: 'Deactivate customer' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customersService.remove(id, user.tenantId);
  }

  @Post('visits')
  @RequirePermissions(Permission.CUSTOMERS_WRITE)
  @ApiOperation({ summary: 'Record customer visit' })
  recordVisit(@Body() data: any, @CurrentUser() user: any) {
    return this.customersService.recordVisit(user.tenantId, { ...data, userId: user.userId });
  }

  @Get(':id/visits')
  @RequirePermissions(Permission.CUSTOMERS_READ)
  @ApiOperation({ summary: 'Get customer visits' })
  getVisits(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customersService.getVisits(id, user.tenantId);
  }
}
