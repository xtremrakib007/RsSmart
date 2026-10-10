import { Module } from '@nestjs/common';
import { LegalPoliciesController } from './policies.controller';
import { LegalPoliciesService } from './policies.service';

@Module({
  controllers: [LegalPoliciesController],
  providers: [LegalPoliciesService],
  exports: [LegalPoliciesService],
})
export class LegalPoliciesModule {}
