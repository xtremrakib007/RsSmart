import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/user.decorator';
import { CurrentOutlet } from '../common/decorators/outlet.decorator';
import { OutletGuard } from '../common/guards/outlet.guard';
import { PosTransactionsService } from './pos-transactions.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';

@ApiTags('POS Transactions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('pos-transactions')
export class PosTransactionsController {
  constructor(private readonly service: PosTransactionsService) {}
  @Post('checkout') @RequirePermissions(Permission.SALES_CREATE) @UseGuards(OutletGuard) @ApiOperation({ summary: 'Create POS sale atomically' }) checkout(@Body() body: any, @CurrentUser() user: any, @CurrentOutlet() outlet: any) { return this.service.checkout(user.tenantId, user.userId, body, outlet.id); }
  @Get('receipt/:orderId') @RequirePermissions(Permission.SALES_READ) @UseGuards(OutletGuard) receipt(@Param('orderId') id: string, @CurrentUser() user: any, @CurrentOutlet() outlet: any) { return this.service.getReceipt(user.tenantId, id, outlet.id); }
  @Post('refund/:orderId') @RequirePermissions(Permission.PAYMENTS_REFUND) @UseGuards(OutletGuard) refund(@Param('orderId') id: string, @Body() body: any, @CurrentUser() user: any, @CurrentOutlet() outlet: any) { return this.service.refund(user.tenantId, user.userId, id, body, outlet.id); }
  @Post('cash-movement') @RequirePermissions(Permission.POS_OPEN) @UseGuards(OutletGuard) cashMovement(@Body() body: any, @CurrentUser() user: any, @CurrentOutlet() outlet: any) { return this.service.cashMovement(user.tenantId, user.userId, body, outlet.id); }
  @Get('daily-summary') @RequirePermissions(Permission.REPORTS_READ) @UseGuards(OutletGuard) dailySummary(@Query('sessionId') sessionId: string, @CurrentUser() user: any, @CurrentOutlet() outlet: any) { return this.service.dailySummary(user.tenantId, sessionId, outlet.id); }
}
