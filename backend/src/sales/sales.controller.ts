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
  @Post('routes') createRoute(@Body() b: any, @CurrentUser() u: any) { return this.sales.createRoute(u.tenantId, u.userId, b); }
  @Post('attendance/check-in') checkIn(@Body() b: any, @CurrentUser() u: any) { return this.sales.checkIn(u.tenantId, u.userId, b); }
  @Post('attendance/check-out') checkOut(@Body() b: any, @CurrentUser() u: any) { return this.sales.checkOut(u.tenantId, u.userId, b); }
  @Get('attendance') attendance(@CurrentUser() u: any, @Query('from') from?: string, @Query('to') to?: string) { return this.sales.attendance(u.tenantId, u.userId, from, to); }
}
