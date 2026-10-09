import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CurrentUser } from '../common/decorators/user.decorator';
import { CurrentOutlet } from '../common/decorators/outlet.decorator';
import { OutletGuard } from '../common/guards/outlet.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';

// Every route here is outlet-scoped: OutletGuard resolves and validates the
// outlet (from the x-outlet-id header, or the user's default outlet if
// omitted) before the handler runs, and rejects the request if the current
// user isn't allowed to act on that outlet (see Phase 11/12).
@ApiTags('Inventory')
@ApiBearerAuth()
@ApiHeader({ name: 'x-outlet-id', required: false, description: "Defaults to the user's default outlet" })
@UseGuards(OutletGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get()
  @RequirePermissions(Permission.INVENTORY_READ)
  @ApiOperation({ summary: 'Get stock levels at the current outlet' })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'lowStock', required: false, type: Boolean })
  getStockLevels(
    @CurrentUser() user: any,
    @CurrentOutlet() outlet: any,
    @Query('productId') productId?: string,
    @Query('lowStock') lowStock?: string,
  ) {
    return this.inventoryService.getStockLevels(user.tenantId, outlet.id, {
      productId,
      lowStock: lowStock === 'true',
    });
  }

  @Get('movements/:productId')
  @RequirePermissions(Permission.INVENTORY_READ)
  @ApiOperation({ summary: 'Get stock movement history at the current outlet' })
  getStockMovement(@Param('productId') productId: string, @CurrentUser() user: any, @CurrentOutlet() outlet: any) {
    return this.inventoryService.getStockMovement(user.tenantId, outlet.id, productId);
  }

  @Post('adjust')
  @RequirePermissions(Permission.INVENTORY_ADJUST)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Adjust stock level at the current outlet' })
  adjustStock(@Body() data: any, @CurrentUser() user: any, @CurrentOutlet() outlet: any) {
    return this.inventoryService.adjustStock(user.tenantId, outlet.id, user.userId, data);
  }

  @Post('reserve')
  @RequirePermissions(Permission.INVENTORY_ADJUST)
  @ApiOperation({ summary: 'Reserve stock at the current outlet' })
  reserveStock(@Body() data: { productId: string; quantity: number }, @CurrentUser() user: any, @CurrentOutlet() outlet: any) {
    return this.inventoryService.reserveStock(user.tenantId, outlet.id, data.productId, data.quantity);
  }

  @Post('release')
  @RequirePermissions(Permission.INVENTORY_ADJUST)
  @ApiOperation({ summary: 'Release reserved stock at the current outlet' })
  releaseStock(@Body() data: { productId: string; quantity: number }, @CurrentUser() user: any, @CurrentOutlet() outlet: any) {
    return this.inventoryService.releaseStock(user.tenantId, outlet.id, data.productId, data.quantity);
  }

  @Post('transfer')
  @RequirePermissions(Permission.INVENTORY_ADJUST)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Transfer stock between warehouses within the current outlet' })
  transferStock(@Body() data: any, @CurrentUser() user: any, @CurrentOutlet() outlet: any) {
    return this.inventoryService.transferStock(user.tenantId, outlet.id, user.userId, data);
  }
}
