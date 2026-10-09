import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { PosSessionsService } from './pos-sessions.service';
import { CurrentUser } from '../common/decorators/user.decorator';
import { CurrentOutlet } from '../common/decorators/outlet.decorator';
import { OutletGuard } from '../common/guards/outlet.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';

@ApiTags('POS Sessions')
@ApiBearerAuth()
@Controller('pos-sessions')
export class PosSessionsController {
  constructor(private posSessionsService: PosSessionsService) {}

  @Get('active')
  @RequirePermissions(Permission.POS_OPEN)
  @ApiOperation({ summary: 'Get active session for device' })
  getActiveSession(
    @Query('deviceId') deviceId: string,
    @CurrentUser() user: any,
  ) {
    return this.posSessionsService.getActiveSession(user.tenantId, user.userId, deviceId);
  }

  @Post('open')
  @RequirePermissions(Permission.POS_OPEN)
  @UseGuards(OutletGuard)
  @ApiHeader({ name: 'x-outlet-id', required: false, description: "Which outlet this terminal is opening at; defaults to the user's default outlet" })
  @ApiOperation({ summary: 'Open POS session at an outlet' })
  openSession(@Body() data: { deviceId: string; openingCash: number; openingDenominations?: Record<string, number> }, @CurrentUser() user: any, @CurrentOutlet() outlet: any) {
    return this.posSessionsService.openSession(user.tenantId, outlet.id, user.userId, data);
  }

  @Put(':id/close')
  @RequirePermissions(Permission.POS_CLOSE)
  @UseGuards(OutletGuard)
  @ApiOperation({ summary: 'Close POS session' })
  closeSession(
    @Param('id') id: string,
    @Body() data: { closingCash: number; closingDenominations?: Record<string, number>; forceClose?: boolean },
    @CurrentUser() user: any,
    @CurrentOutlet() outlet: any,
  ) {
    return this.posSessionsService.closeSession(user.tenantId, id, data, outlet.id);
  }

  @Get(':id/report')
  @RequirePermissions(Permission.REPORTS_READ)
  @UseGuards(OutletGuard)
  @ApiOperation({ summary: 'Get session report' })
  getSessionReport(@Param('id') id: string, @CurrentUser() user: any, @CurrentOutlet() outlet: any) {
    return this.posSessionsService.getSessionReport(user.tenantId, id, outlet.id);
  }

  @Get()
  @RequirePermissions(Permission.REPORTS_READ)
  @UseGuards(OutletGuard)
  @ApiOperation({ summary: 'Get all sessions' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'outletId', required: false })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  getSessions(
    @CurrentUser() user: any,
    @Query('userId') userId?: string,
    @Query('outletId') outletId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @CurrentOutlet() outlet: any,
  ) {
    return this.posSessionsService.getSessions(user.tenantId, { userId, outletId: outlet.id, fromDate, toDate });
  }
}
