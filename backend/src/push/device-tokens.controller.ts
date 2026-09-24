import { Controller, Post, Delete, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DeviceTokensService } from './device-tokens.service';
import { CurrentUser } from '../common/decorators/user.decorator';

@ApiTags('Push')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('push/devices')
export class DeviceTokensController {
  constructor(private deviceTokensService: DeviceTokensService) {}

  @Post()
  @ApiOperation({ summary: 'Register or refresh this device\'s FCM token' })
  register(
    @Body() data: { deviceId: string; token: string; platform?: string },
    @CurrentUser() user: any,
  ) {
    return this.deviceTokensService.register(
      user.tenantId,
      user.userId,
      data.deviceId,
      data.token,
      data.platform,
    );
  }

  @Delete()
  @ApiOperation({ summary: 'Unregister this device (call on logout)' })
  unregister(@Body() data: { deviceId: string }, @CurrentUser() user: any) {
    return this.deviceTokensService.unregister(user.tenantId, data.deviceId);
  }
}
