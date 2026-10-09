import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/user.decorator';
import { PosTransactionsService } from './pos-transactions.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';

@ApiTags('POS Transactions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('pos-transactions')
export class PosTransactionsController {
  constructor(private readonly service: PosTransactionsService) {}
  @Post('checkout') @RequirePermissions(Permission.SALES_CREATE) @ApiOperation({ summary: 'Create POS sale atomically' }) checkout(@Body() body: any, @CurrentUser() user: any) { return this.service.checkout(user.tenantId, user.userId, body); }
  @Get('receipt/:orderId') @RequirePermissions(Permission.SALES_READ) receipt(@Param('orderId') id: string, @CurrentUser() user: any) { return this.service.getReceipt(user.tenantId, id); }
  @Post('refund/:orderId') @RequirePermissions(Permission.SALES_CREATE) refund(@Param('orderId') id: string, @Body() body: any, @CurrentUser() user: any) { return this.service.refund(user.tenantId, user.userId, id, body); }
  @Post('cash-movement') @RequirePermissions(Permission.POS_OPEN) cashMovement(@Body() body: any, @CurrentUser() user: any) { return this.service.cashMovement(user.tenantId, user.userId, body); }
  @Get('daily-summary') @RequirePermissions(Permission.REPORTS_READ) dailySummary(@Query('sessionId') sessionId: string, @CurrentUser() user: any) { return this.service.dailySummary(user.tenantId, sessionId); }
}
