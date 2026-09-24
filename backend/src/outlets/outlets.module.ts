import { Module } from '@nestjs/common';
import { OutletsService } from './outlets.service';
import { OutletsController } from './outlets.controller';
import { AuditModule } from '../audit/audit.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [AuditModule, EntitlementsModule],
  controllers: [OutletsController],
  providers: [OutletsService],
  exports: [OutletsService],
})
export class OutletsModule {}
