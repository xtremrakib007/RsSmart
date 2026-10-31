import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/user.decorator';
import { SalesService } from './sales.service';

@ApiTags('Field Sales')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}
  @Get('dashboard') dashboard(@CurrentUser() u: any) { return this.sales.dashboard(u.tenantId, u.userId); }
  @Get('targets') targets(@CurrentUser() u: any) { return this.sales.listTargets(u.tenantId, u.userId); }
  @Post('targets') createTarget(@Body() b: any, @CurrentUser() u: any) { return this.sales.createTarget(u.tenantId, b); }
  @Get('routes') routes(@CurrentUser() u: any, @Query('date') date?: string) { return this.sales.listRoutes(u.tenantId, u.userId, date); }
  @Post('routes') createRoute(@Body() b: any, @CurrentUser() u: any) { return this.sales.createRoute(u.tenantId, u.userId, b, u.roles); }
  @Get('today') today(@CurrentUser() u: any) { return this.sales.today(u.tenantId, u.userId); }
  @Get('customers') customers(@CurrentUser() u: any, @Query('route') route?: string) { return this.sales.myCustomers(u.tenantId, u.userId, u.roles, route); }
  @Get('customers/nearby') nearby(@CurrentUser() u: any, @Query('lat') lat: string, @Query('lng') lng: string, @Query('limit') limit?: string) {
    return this.sales.nearby(u.tenantId, u.userId, u.roles, Number(lat), Number(lng), limit ? Number(limit) : 50);
  }
  @Get('route-names') routeNames(@CurrentUser() u: any) { return this.sales.routeNames(u.tenantId, u.userId, u.roles); }
  @Post('customers/assign') assign(@Body() b: any, @CurrentUser() u: any) { return this.sales.assignCustomers(u.tenantId, u.roles, b); }
  @Get('team/attendance') team(@CurrentUser() u: any, @Query('date') date?: string) { return this.sales.teamAttendance(u.tenantId, u.roles, date); }
  @Post('attendance/check-in') checkIn(@Body() b: any, @CurrentUser() u: any) { return this.sales.checkIn(u.tenantId, u.userId, b); }
  @Post('attendance/check-out') checkOut(@Body() b: any, @CurrentUser() u: any) { return this.sales.checkOut(u.tenantId, u.userId, b); }
  @Get('attendance') attendance(@CurrentUser() u: any, @Query('from') from?: string, @Query('to') to?: string) { return this.sales.attendance(u.tenantId, u.userId, from, to); }
}
