import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CurrentUser } from '../common/decorators/user.decorator';
import { CurrentOutlet } from '../common/decorators/outlet.decorator';
import { OutletGuard } from '../common/guards/outlet.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all orders' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'outletId', required: false })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50, description: 'Maximum 100 records per request' })
  findAll(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('outletId') outletId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.findAll(user.tenantId, { status, customerId, outletId, fromDate, toDate, page, limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ordersService.findOne(id, user.tenantId);
  }

  @Post()
  @UseGuards(OutletGuard)
  @ApiHeader({ name: 'x-outlet-id', required: false, description: "Which outlet this order belongs to; defaults to the user's default outlet" })
  @ApiOperation({ summary: 'Create order at an outlet' })
  create(@Body() data: any, @CurrentUser() user: any, @CurrentOutlet() outlet: any) {
    return this.ordersService.create(user.tenantId, outlet.id, user.userId, data);
  }

  @Put(':id/status')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Update order status' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.updateStatus(id, user.tenantId, status, user.userId);
  }

  @Post(':id/payments')
  @ApiOperation({ summary: 'Add payment to order' })
  addPayment(@Param('id') id: string, @Body() data: any, @CurrentUser() user: any) {
    return this.ordersService.addPayment(id, user.tenantId, { ...data, createdBy: user.userId });
  }
}
