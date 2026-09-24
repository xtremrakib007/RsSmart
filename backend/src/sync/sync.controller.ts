import { Controller, Post, Get, Body, Query, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SyncService } from './sync.service';
import { SyncHealthService } from './health/sync-health.service';
import { CurrentUser } from '../common/decorators/user.decorator';
import { PushEventsDto } from './dto/push-events.dto';
import { PullEventsDto } from './dto/pull-events.dto';
import { AckEventsDto } from './dto/ack-events.dto';

@ApiTags('Sync')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('sync')
export class SyncController {
  constructor(
    private syncService: SyncService,
    private syncHealthService: SyncHealthService,
  ) {}

  @Post('push')
  @ApiOperation({ summary: 'Push offline events to server' })
  pushEvents(@Body() body: PushEventsDto, @CurrentUser() user: any) {
    return this.syncService.pushEvents(user.tenantId, body.clientId, body.events);
  }

  @Post('pull')
  @ApiOperation({ summary: 'Pull server events since last sync' })
  pullEvents(@Body() body: PullEventsDto, @CurrentUser() user: any) {
    return this.syncService.pullEvents(user.tenantId, body.clientId, body.lastSyncAt, {
      entities: body.entities,
      deltaOnly: body.deltaOnly,
      limit: body.limit,
    });
  }

  @Post('ack')
  @ApiOperation({ summary: 'Acknowledge received events to prevent duplicates on retry' })
  ackEvents(@Body() body: AckEventsDto, @CurrentUser() user: any) {
    return this.syncService.ackEvents(user.tenantId, body.clientId, body.eventIds);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get sync status for client' })
  getStatus(
    @Query('clientId') clientId: string,
    @CurrentUser() user: any,
  ) {
    return this.syncService.getSyncStatus(user.tenantId, clientId);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get pending sync events' })
  getPending(@CurrentUser() user: any) {
    return this.syncService.getPendingEvents(user.tenantId);
  }

  @Get('failed')
  @ApiOperation({ summary: 'Get failed sync events for admin review' })
  getFailed(
    @Query('clientId') clientId: string,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @CurrentUser() user: any,
  ) {
    return this.syncService.getFailedEvents(user.tenantId, {
      clientId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post('retry/:eventId')
  @ApiOperation({ summary: 'Retry a failed sync event' })
  retryEvent(
    @Param('eventId') eventId: string,
    @CurrentUser() user: any,
  ) {
    return this.syncService.retryEvent(user.tenantId, eventId);
  }
}
