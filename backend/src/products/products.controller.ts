import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ProductsService } from './products.service';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  @RequirePermissions(Permission.PRODUCTS_READ)
  @ApiOperation({ summary: 'Get all products' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  findAll(
    @CurrentUser() user: any,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.productsService.findAll(user.tenantId, { search, categoryId });
  }

  @Get('barcode/:barcode')
  @RequirePermissions(Permission.PRODUCTS_READ)
  @ApiOperation({ summary: 'Get product by barcode' })
  findByBarcode(@Param('barcode') barcode: string, @CurrentUser() user: any) {
    return this.productsService.findByBarcode(barcode, user.tenantId);
  }

  @Get(':id')
  @RequirePermissions(Permission.PRODUCTS_READ)
  @ApiOperation({ summary: 'Get product by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.findOne(id, user.tenantId);
  }

  @Post()
  @RequirePermissions(Permission.PRODUCTS_WRITE)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Create product' })
  create(@Body() data: any, @CurrentUser() user: any) {
    return this.productsService.create(user.tenantId, data);
  }

  @Put(':id')
  @RequirePermissions(Permission.PRODUCTS_WRITE)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Update product' })
  update(@Param('id') id: string, @Body() data: any, @CurrentUser() user: any) {
    return this.productsService.update(id, user.tenantId, data);
  }

  @Delete(':id')
  @RequirePermissions(Permission.PRODUCTS_WRITE)
  @Roles('admin')
  @ApiOperation({ summary: 'Deactivate product' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.remove(id, user.tenantId);
  }

  @Get('categories/list')
  @RequirePermissions(Permission.PRODUCTS_READ)
  @ApiOperation({ summary: 'Get all categories' })
  getCategories(@CurrentUser() user: any) {
    return this.productsService.getCategories(user.tenantId);
  }

  @Get('units/list')
  @RequirePermissions(Permission.PRODUCTS_READ)
  @ApiOperation({ summary: 'Get all units' })
  getUnits(@CurrentUser() user: any) {
    return this.productsService.getUnits(user.tenantId);
  }
}
