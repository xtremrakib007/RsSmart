import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SyncHealthService } from './sync-health.service';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Sync Health')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('sync-health')
export class SyncHealthController {
  constructor(private syncHealthService: SyncHealthService) {}

  @Get('dashboard')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Get sync health dashboard' })
  getDashboard(@CurrentUser() user: any) {
    return this.syncHealthService.getDashboard(user.tenantId);
  }

  @Get('devices')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Get device sync statistics' })
  getDeviceStats(@CurrentUser() user: any) {
    return this.syncHealthService.getDeviceStats(user.tenantId);
  }

  @Post('resolve/:eventId')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Resolve a sync conflict' })
  resolveConflict(
    @Param('eventId') eventId: string,
    @Body() body: { resolution: 'accept' | 'reject' | 'merge'; mergeData?: any },
  ) {
    return this.syncHealthService.resolveConflict(eventId, body.resolution, body.mergeData);
  }

  @Post('retry-failed')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Retry all failed events' })
  @ApiQuery({ name: 'clientId', required: false })
  retryFailed(
    @CurrentUser() user: any,
    @Query('clientId') clientId?: string,
  ) {
    return this.syncHealthService.retryFailedEvents(user.tenantId, clientId);
  }
}
