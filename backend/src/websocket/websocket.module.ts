import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsGateway } from './notifications.gateway';

// The gateway verifies socket tokens with the same secret as the API.
@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET })],
  providers: [NotificationsGateway],
  exports: [NotificationsGateway],
})
export class WebsocketModule {}
