import { Module } from '@nestjs/common';
import { PushService } from './push.service';
import { DeviceTokensService } from './device-tokens.service';
import { DeviceTokensController } from './device-tokens.controller';

@Module({
  controllers: [DeviceTokensController],
  providers: [PushService, DeviceTokensService],
  exports: [PushService, DeviceTokensService],
})
export class PushModule {}
