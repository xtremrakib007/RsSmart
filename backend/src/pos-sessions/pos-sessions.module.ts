import { Module } from '@nestjs/common';
import { PosSessionsController } from './pos-sessions.controller';
import { PosSessionsService } from './pos-sessions.service';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [EntitlementsModule],
  controllers: [PosSessionsController],
  providers: [PosSessionsService],
  exports: [PosSessionsService],
})
export class PosSessionsModule {}
