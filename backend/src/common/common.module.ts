import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { RequestIdMiddleware } from './middleware/request-id.middleware';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  exports: [PrismaModule],
})
export class CommonModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
